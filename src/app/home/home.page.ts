import { Component } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { SessionTimerService } from '../shared/services/session-timer.service';
import { AuthService } from '../features/auth/services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  readonly vm$ = combineLatest([
    this.session.info$,
    this.session.remainingSeconds$,
  ]).pipe(
    map(([info, seconds]) => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return {
        active: this.session.isActive && !!info,
        name: info?.userName ?? 'Usuário',
        oab: info?.oabNumber ?? '---',
        remaining: `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
      };
    })
  );

  constructor(
    private readonly session: SessionTimerService,
    private readonly auth: AuthService
  ) {}

  minimizeToTray(): void {
    const api = (window as any).electronAPI;
    if (api?.hideToTray) {
      api.hideToTray();
    } else {
      window.close();
    }
  }

  endSession(): void {
    this.auth.logout();
    (window as any).electronAPI?.endSession?.();
  }
}
