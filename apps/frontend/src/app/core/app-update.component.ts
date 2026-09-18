import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
} from '@angular/core';
import { DaaifAppUpdateService } from './app-update.service';

@Component({
  selector: 'app-update',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (update.updateReady()) {
      <button
        class="app-update-trigger"
        type="button"
        data-testid="app-update-reload"
        aria-haspopup="dialog"
        aria-controls="daaif-app-update-confirmation"
        [attr.aria-label]="buttonLabel()"
        (click)="openConfirmation()"
      >
        Neue Version
      </button>
    }

    <dialog
      #confirmation
      id="daaif-app-update-confirmation"
      class="app-update-confirmation"
      data-testid="app-update-confirmation"
      aria-labelledby="daaif-update-title"
      aria-describedby="daaif-update-description"
      (cancel)="cancel($event)"
      (click)="closeOnBackdrop($event)"
    >
      <div class="app-update-card">
        <p class="app-update-kicker">Neue Version verfügbar</p>
        <h2 id="daaif-update-title">DAAIF jetzt neu laden?</h2>
        <p id="daaif-update-description">
          Nicht gespeicherte Eingaben gehen beim Neuladen verloren. Die neue Version wird
          anschliessend vollständig geladen.
        </p>
        <p class="app-update-transition">{{ transitionLabel() }}</p>
        <div class="app-update-actions">
          <button
            #cancelButton
            class="button button-secondary"
            type="button"
            (click)="closeConfirmation()"
          >
            Abbrechen
          </button>
          <button class="button button-primary" type="button" (click)="confirmUpdate()">
            Jetzt aktualisieren
          </button>
        </div>
      </div>
    </dialog>

    @if (update.updating()) {
      <div class="app-update-screen" role="status" aria-live="assertive" aria-busy="true">
        <div class="app-update-card app-update-progress">
          <span class="app-update-spinner" aria-hidden="true"></span>
          <div>
            <h2>DAAIF wird aktualisiert</h2>
            <p class="app-update-transition">{{ transitionLabel() }}</p>
            <p>Die neue Version wird vollständig geladen. Bitte warten.</p>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppUpdateComponent {
  readonly update = inject(DaaifAppUpdateService);
  @ViewChild('confirmation', { static: true })
  private readonly confirmation!: ElementRef<HTMLDialogElement>;
  @ViewChild('cancelButton') private readonly cancelButton?: ElementRef<HTMLButtonElement>;

  readonly buttonLabel = computed(() => {
    const target = this.update.targetVersion();
    return target ? `Neue DAAIF-Version V${target} laden` : 'Neue DAAIF-Version laden';
  });
  readonly transitionLabel = computed(() => {
    const target = this.update.targetVersion();
    return target && target !== this.update.currentVersion
      ? `DAAIF · V${this.update.currentVersion} → V${target}`
      : `DAAIF · Build-Aktualisierung für V${this.update.currentVersion}`;
  });

  openConfirmation(): void {
    const dialog = this.confirmation.nativeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    queueMicrotask(() => this.cancelButton?.nativeElement.focus());
  }

  closeConfirmation(): void {
    const dialog = this.confirmation.nativeElement;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  confirmUpdate(): void {
    this.closeConfirmation();
    this.update.reloadToLatest();
  }

  cancel(event: Event): void {
    event.preventDefault();
    this.closeConfirmation();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.confirmation.nativeElement) this.closeConfirmation();
  }
}
