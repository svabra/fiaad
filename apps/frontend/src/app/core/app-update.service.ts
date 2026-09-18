import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  EnvironmentProviders,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  computed,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { DAAIF_VERSION } from './app-version';

export type DaaifAppUpdatePhase = 'idle' | 'installing' | 'ready' | 'reloading';

export interface DaaifAppUpdateConfig {
  readonly appId: 'daaif-frontend';
  readonly checkIntervalMs?: number;
}

export interface DaaifAppUpdateSnapshot {
  readonly phase: DaaifAppUpdatePhase;
  readonly latestHash: string | null;
  readonly targetVersion: string | null;
}

export interface DaaifAppUpdateRuntime {
  readonly isBrowser: boolean;
  readonly documentTarget: EventTarget | null;
  readonly windowTarget: EventTarget | null;
  readonly serviceWorkerTarget: EventTarget | null;
  hasServiceWorkerController(): boolean;
  isOnline(): boolean;
  isDocumentVisible(): boolean;
  setInterval(callback: () => void, delay: number): number;
  clearInterval(handle: number): void;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
  readSessionValue(key: string): string | null;
  writeSessionValue(key: string, value: string): void;
  reload(): void;
}

const DEFAULT_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const RELOAD_DELAY_MS = 550;
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export const DAAIF_APP_UPDATE_CONFIG = new InjectionToken<DaaifAppUpdateConfig>(
  'DAAIF_APP_UPDATE_CONFIG',
);

export const DAAIF_APP_UPDATE_RUNTIME = new InjectionToken<DaaifAppUpdateRuntime>(
  'DAAIF_APP_UPDATE_RUNTIME',
  {
    factory: () => {
      const document = inject(DOCUMENT);
      const platformId = inject(PLATFORM_ID);
      const browserWindow = document.defaultView;
      const serviceWorker = browserWindow?.navigator.serviceWorker ?? null;

      return {
        isBrowser: isPlatformBrowser(platformId) && browserWindow !== null,
        documentTarget: document,
        windowTarget: browserWindow,
        serviceWorkerTarget: serviceWorker,
        hasServiceWorkerController: () => serviceWorker?.controller != null,
        isOnline: () => browserWindow?.navigator.onLine !== false,
        isDocumentVisible: () => document.visibilityState === 'visible',
        setInterval: (callback, delay) => browserWindow?.setInterval(callback, delay) ?? -1,
        clearInterval: (handle) => browserWindow?.clearInterval(handle),
        setTimeout: (callback, delay) => browserWindow?.setTimeout(callback, delay) ?? -1,
        clearTimeout: (handle) => browserWindow?.clearTimeout(handle),
        readSessionValue: (key) => {
          try {
            return browserWindow?.sessionStorage.getItem(key) ?? null;
          } catch {
            return null;
          }
        },
        writeSessionValue: (key, value) => {
          try {
            browserWindow?.sessionStorage.setItem(key, value);
          } catch {
            // A blocked session store must not make the running app unusable.
          }
        },
        reload: () => document.location.reload(),
      } satisfies DaaifAppUpdateRuntime;
    },
  },
);

/**
 * Coordinates service-worker updates without activating a new bundle inside
 * a running application. Adoption happens through a full-page reload so app
 * shell and lazy chunks always come from the same build.
 */
@Injectable()
export class DaaifAppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly config = inject(DAAIF_APP_UPDATE_CONFIG);
  private readonly runtime = inject(DAAIF_APP_UPDATE_RUNTIME);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mutableState = signal<DaaifAppUpdateSnapshot>({
    phase: 'idle',
    latestHash: null,
    targetVersion: null,
  });

  readonly state = this.mutableState.asReadonly();
  readonly updateReady = computed(() => this.state().phase === 'ready');
  readonly updating = computed(
    () => this.state().phase === 'installing' || this.state().phase === 'reloading',
  );
  readonly targetVersion = computed(() => this.state().targetVersion);
  readonly currentVersion = DAAIF_VERSION;

  private initialized = false;
  private startupCheckPending = true;
  private startupInteractionDetected = false;
  private checkInFlight = false;
  private interactionCleanups: Array<() => void> = [];
  private lifecycleCleanups: Array<() => void> = [];
  private intervalHandle: number | null = null;
  private reloadHandle: number | null = null;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.runtime.isBrowser || !this.swUpdate.isEnabled) {
      this.finishStartupCheck();
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleVersionEvent(event));
    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.handleUnrecoverableState());

    this.listenForStartupInteraction();
    this.listenForLaterChecks();
    this.destroyRef.onDestroy(() => this.dispose());

    if (this.runtime.hasServiceWorkerController()) {
      void this.checkForUpdates(true);
    } else {
      this.finishStartupCheck();
    }
  }

  checkNow(): Promise<void> {
    return this.checkForUpdates(false);
  }

  reloadToLatest(): void {
    this.reloadReadyUpdate(false);
  }

  private reloadReadyUpdate(automatic: boolean): void {
    const update = this.state();
    if (update.phase !== 'ready' || !update.latestHash) return;

    const guardPersisted = this.rememberReloadedHash(update.latestHash);
    if (automatic && !guardPersisted) return;

    this.mutableState.set({ ...update, phase: 'reloading' });
    this.reloadHandle = this.runtime.setTimeout(() => this.runtime.reload(), RELOAD_DELAY_MS);
  }

  private async checkForUpdates(initial: boolean): Promise<void> {
    if (
      this.checkInFlight ||
      this.state().phase !== 'idle' ||
      !this.runtime.hasServiceWorkerController() ||
      !this.runtime.isOnline()
    ) {
      if (initial) this.finishStartupCheck();
      return;
    }

    this.checkInFlight = true;
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      this.failSafely();
    } finally {
      this.checkInFlight = false;
      if (initial) this.finishStartupCheck();
    }
  }

  private handleVersionEvent(event: VersionEvent): void {
    switch (event.type) {
      case 'VERSION_DETECTED':
        if (this.startupCheckPending && !this.startupInteractionDetected) {
          this.mutableState.set({
            phase: 'installing',
            latestHash: event.version.hash,
            targetVersion: this.readTargetVersion(event.version.appData),
          });
        }
        break;
      case 'VERSION_READY': {
        if (
          this.state().phase === 'reloading' &&
          this.state().latestHash === event.latestVersion.hash
        )
          break;
        this.mutableState.set({
          phase: 'ready',
          latestHash: event.latestVersion.hash,
          targetVersion: this.readTargetVersion(event.latestVersion.appData),
        });
        if (
          !this.wasHashAlreadyReloaded(event.latestVersion.hash) &&
          this.startupCheckPending &&
          !this.startupInteractionDetected
        ) {
          this.reloadReadyUpdate(true);
        }
        break;
      }
      case 'VERSION_INSTALLATION_FAILED':
        this.failSafely(event.version.hash);
        break;
      case 'NO_NEW_VERSION_DETECTED':
        break;
    }
  }

  private readTargetVersion(appData: object | undefined): string | null {
    if (!appData || typeof appData !== 'object') return null;
    const candidate = appData as Record<string, unknown>;
    return candidate['schemaVersion'] === 1 &&
      candidate['appId'] === this.config.appId &&
      typeof candidate['releaseVersion'] === 'string' &&
      RELEASE_VERSION_PATTERN.test(candidate['releaseVersion'])
      ? candidate['releaseVersion']
      : null;
  }

  private listenForStartupInteraction(): void {
    const markInteraction = () => {
      this.startupInteractionDetected = true;
    };
    for (const eventName of ['pointerdown', 'keydown', 'input', 'submit']) {
      this.addListener(
        this.runtime.documentTarget,
        eventName,
        markInteraction,
        this.interactionCleanups,
        true,
      );
    }
  }

  private listenForLaterChecks(): void {
    this.addListener(
      this.runtime.windowTarget,
      'online',
      () => void this.checkForUpdates(false),
      this.lifecycleCleanups,
    );
    this.addListener(
      this.runtime.documentTarget,
      'visibilitychange',
      () => {
        if (this.runtime.isDocumentVisible()) void this.checkForUpdates(false);
      },
      this.lifecycleCleanups,
    );
    this.addListener(
      this.runtime.serviceWorkerTarget,
      'controllerchange',
      () => void this.checkForUpdates(false),
      this.lifecycleCleanups,
    );

    const interval = this.config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    if (interval > 0) {
      this.intervalHandle = this.runtime.setInterval(
        () => void this.checkForUpdates(false),
        interval,
      );
    }
  }

  private addListener(
    target: EventTarget | null,
    eventName: string,
    listener: EventListener,
    cleanups: Array<() => void>,
    capture = false,
  ): void {
    if (!target) return;
    target.addEventListener(eventName, listener, { capture, passive: true });
    cleanups.push(() => target.removeEventListener(eventName, listener, capture));
  }

  private finishStartupCheck(): void {
    this.startupCheckPending = false;
    for (const cleanup of this.interactionCleanups.splice(0)) cleanup();
  }

  private failSafely(failedHash?: string): void {
    const current = this.state();
    if (!failedHash || current.latestHash === failedHash) {
      this.mutableState.set({ phase: 'idle', latestHash: null, targetVersion: null });
    }
  }

  private handleUnrecoverableState(): void {
    const key = `daaif.app-update.unrecoverable.${this.config.appId}.${DAAIF_VERSION}`;
    if (this.runtime.readSessionValue(key) === 'reloaded') {
      if (this.state().phase !== 'reloading') this.failSafely();
      return;
    }
    this.runtime.writeSessionValue(key, 'reloaded');
    if (this.runtime.readSessionValue(key) !== 'reloaded') {
      this.failSafely();
      return;
    }
    this.mutableState.set({ phase: 'reloading', latestHash: null, targetVersion: null });
    this.reloadHandle = this.runtime.setTimeout(() => this.runtime.reload(), RELOAD_DELAY_MS);
  }

  private reloadStorageKey(): string {
    return `daaif.app-update.reloaded-hash.${this.config.appId}`;
  }

  private wasHashAlreadyReloaded(hash: string): boolean {
    return this.runtime.readSessionValue(this.reloadStorageKey()) === hash;
  }

  private rememberReloadedHash(hash: string): boolean {
    this.runtime.writeSessionValue(this.reloadStorageKey(), hash);
    return this.runtime.readSessionValue(this.reloadStorageKey()) === hash;
  }

  private dispose(): void {
    for (const cleanup of [...this.interactionCleanups, ...this.lifecycleCleanups]) cleanup();
    this.interactionCleanups = [];
    this.lifecycleCleanups = [];
    if (this.intervalHandle !== null) this.runtime.clearInterval(this.intervalHandle);
    if (this.reloadHandle !== null) this.runtime.clearTimeout(this.reloadHandle);
  }
}

export function provideDaaifAppUpdates(config: DaaifAppUpdateConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DAAIF_APP_UPDATE_CONFIG, useValue: config },
    DaaifAppUpdateService,
    provideEnvironmentInitializer(() => inject(DaaifAppUpdateService).initialize()),
  ]);
}
