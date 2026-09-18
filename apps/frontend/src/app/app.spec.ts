import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { DaaifAppUpdateService } from './core/app-update.service';
import { RealtimeService } from './core/realtime.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: RealtimeService,
          useValue: { state: signal('offline'), latestEvent: signal(null), start: () => undefined },
        },
        {
          provide: DaaifAppUpdateService,
          useValue: {
            updateReady: signal(false),
            updating: signal(false),
            targetVersion: signal(null),
            currentVersion: '0.1.0',
            reloadToLatest: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the DAAIF brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-copy strong')?.textContent).toContain('DAAIF');
  });
});
