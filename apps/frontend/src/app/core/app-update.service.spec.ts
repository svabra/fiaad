import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import {
  DAAIF_APP_UPDATE_CONFIG,
  DAAIF_APP_UPDATE_RUNTIME,
  DaaifAppUpdateRuntime,
  DaaifAppUpdateService,
} from './app-update.service';

class SwUpdateStub {
  readonly isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<UnrecoverableStateEvent>();
  readonly checkForUpdate = vi.fn().mockResolvedValue(false);
}

class UpdateRuntimeStub implements DaaifAppUpdateRuntime {
  readonly isBrowser = true;
  readonly documentTarget = new EventTarget();
  readonly windowTarget = new EventTarget();
  readonly serviceWorkerTarget = new EventTarget();
  readonly storage = new Map<string, string>();
  readonly reload = vi.fn();
  controller = true;
  online = true;
  visible = true;
  storageAvailable = true;
  private nextTimer = 1;
  private readonly timeouts = new Map<number, () => void>();
  private readonly intervals = new Map<number, () => void>();

  hasServiceWorkerController(): boolean {
    return this.controller;
  }
  isOnline(): boolean {
    return this.online;
  }
  isDocumentVisible(): boolean {
    return this.visible;
  }
  setInterval(callback: () => void): number {
    const handle = this.nextTimer++;
    this.intervals.set(handle, callback);
    return handle;
  }
  clearInterval(handle: number): void {
    this.intervals.delete(handle);
  }
  setTimeout(callback: () => void): number {
    const handle = this.nextTimer++;
    this.timeouts.set(handle, callback);
    return handle;
  }
  clearTimeout(handle: number): void {
    this.timeouts.delete(handle);
  }
  readSessionValue(key: string): string | null {
    return this.storageAvailable ? (this.storage.get(key) ?? null) : null;
  }
  writeSessionValue(key: string, value: string): void {
    if (this.storageAvailable) this.storage.set(key, value);
  }
  runTimeouts(): void {
    const callbacks = [...this.timeouts.values()];
    this.timeouts.clear();
    callbacks.forEach((callback) => callback());
  }
  runIntervals(): void {
    [...this.intervals.values()].forEach((callback) => callback());
  }
}

function readyEvent(
  hash = 'new-hash',
  appData: object = {
    schemaVersion: 1,
    appId: 'daaif-frontend',
    releaseVersion: '0.2.0',
  },
): VersionEvent {
  return {
    type: 'VERSION_READY',
    currentVersion: { hash: 'old-hash' },
    latestVersion: { hash, appData },
  };
}

describe('DaaifAppUpdateService', () => {
  let service: DaaifAppUpdateService;
  let swUpdate: SwUpdateStub;
  let runtime: UpdateRuntimeStub;

  beforeEach(() => {
    swUpdate = new SwUpdateStub();
    runtime = new UpdateRuntimeStub();
    TestBed.configureTestingModule({
      providers: [
        DaaifAppUpdateService,
        { provide: SwUpdate, useValue: swUpdate },
        {
          provide: DAAIF_APP_UPDATE_CONFIG,
          useValue: { appId: 'daaif-frontend', checkIntervalMs: 0 },
        },
        { provide: DAAIF_APP_UPDATE_RUNTIME, useValue: runtime },
      ],
    });
    service = TestBed.inject(DaaifAppUpdateService);
  });

  it('blocks an untouched startup and reloads exactly once after VERSION_READY', () => {
    swUpdate.checkForUpdate.mockReturnValue(new Promise(() => undefined));
    service.initialize();
    swUpdate.versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: {
        hash: 'new-hash',
        appData: { schemaVersion: 1, appId: 'daaif-frontend', releaseVersion: '0.2.0' },
      },
    });
    expect(service.state()).toEqual({
      phase: 'installing',
      latestHash: 'new-hash',
      targetVersion: '0.2.0',
    });

    swUpdate.versionUpdates.next(readyEvent());
    swUpdate.versionUpdates.next(readyEvent());
    runtime.runTimeouts();
    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });

  it('requires manual confirmation after startup interaction', () => {
    swUpdate.checkForUpdate.mockReturnValue(new Promise(() => undefined));
    service.initialize();
    runtime.documentTarget.dispatchEvent(new Event('pointerdown'));
    swUpdate.versionUpdates.next(readyEvent());

    expect(service.state().phase).toBe('ready');
    runtime.runTimeouts();
    expect(runtime.reload).not.toHaveBeenCalled();

    service.reloadToLatest();
    runtime.runTimeouts();
    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });

  it('does not auto-reload without a readable loop guard', () => {
    runtime.storageAvailable = false;
    swUpdate.checkForUpdate.mockReturnValue(new Promise(() => undefined));
    service.initialize();
    swUpdate.versionUpdates.next(readyEvent());
    runtime.runTimeouts();
    expect(service.state().phase).toBe('ready');
    expect(runtime.reload).not.toHaveBeenCalled();
  });

  it('keeps the running version usable when installation fails', () => {
    swUpdate.checkForUpdate.mockReturnValue(new Promise(() => undefined));
    service.initialize();
    swUpdate.versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'broken-hash' } });
    swUpdate.versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'broken-hash' },
      error: 'private worker failure',
    });
    expect(service.state()).toEqual({ phase: 'idle', latestHash: null, targetVersion: null });
  });

  it('accepts only exact DAAIF app metadata', () => {
    swUpdate.checkForUpdate.mockReturnValue(new Promise(() => undefined));
    service.initialize();
    runtime.documentTarget.dispatchEvent(new Event('keydown'));
    swUpdate.versionUpdates.next(
      readyEvent('new-hash', {
        schemaVersion: 1,
        appId: 'another-ui',
        releaseVersion: '0.2.0-beta.1',
      }),
    );
    expect(service.state().targetVersion).toBeNull();
  });

  it('checks again when returning online or visible', async () => {
    runtime.online = false;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DaaifAppUpdateService,
        { provide: SwUpdate, useValue: swUpdate },
        {
          provide: DAAIF_APP_UPDATE_CONFIG,
          useValue: { appId: 'daaif-frontend', checkIntervalMs: 25 },
        },
        { provide: DAAIF_APP_UPDATE_RUNTIME, useValue: runtime },
      ],
    });
    service = TestBed.inject(DaaifAppUpdateService);
    service.initialize();

    runtime.online = true;
    runtime.windowTarget.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1));
    runtime.visible = true;
    runtime.documentTarget.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(2));
    runtime.runIntervals();
    await vi.waitFor(() => expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(3));
  });
});
