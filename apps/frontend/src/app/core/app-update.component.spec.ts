import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppUpdateComponent } from './app-update.component';
import { DaaifAppUpdateService } from './app-update.service';

describe('AppUpdateComponent', () => {
  it('confirms a ready update before reloading', async () => {
    const reloadToLatest = vi.fn();
    const update = {
      updateReady: signal(true),
      updating: signal(false),
      targetVersion: signal<string | null>('0.2.0'),
      currentVersion: '0.1.0',
      reloadToLatest,
    } as unknown as DaaifAppUpdateService;

    await TestBed.configureTestingModule({
      imports: [AppUpdateComponent],
      providers: [{ provide: DaaifAppUpdateService, useValue: update }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppUpdateComponent);
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="app-update-reload"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Neue DAAIF-Version V0.2.0 laden');
    trigger.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector(
      '[data-testid="app-update-confirmation"]',
    ) as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('DAAIF · V0.1.0 → V0.2.0');
    const confirm = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Jetzt aktualisieren',
    ) as HTMLButtonElement;
    confirm.click();
    expect(reloadToLatest).toHaveBeenCalledTimes(1);
  });
});
