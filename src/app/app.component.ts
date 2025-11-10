import { Component } from '@angular/core';
import { PasswordPopupService } from './shared/services/password-popup.service';
import { SessionTimerService } from './shared/services/session-timer.service';
import { AuthService } from './features/auth/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private readonly pwdPopup: PasswordPopupService,
    private readonly session: SessionTimerService,
    private readonly auth: AuthService
  ) {
    // Função global usada pelo processo principal (Electron) para solicitar a senha ao fechar
    (window as any).__REQUEST_ADMIN_PASSWORD__ = async () => {
      const password = await this.pwdPopup.open();
      if (!password) return false;
      const ok: boolean = await (window as any).electronAPI?.verifyAdminPassword?.(password);
      return !!ok;
    };
    // Inicia sessão na janela dedicada quando solicitado pelo processo principal
    (window as any).__START_SESSION__ = () => {
      if (!this.session.isActive) {
        this.session.start({ userName: 'Gustavo', oabNumber: '123', totalSeconds: 30 * 60 });
      }
    };
  }
}
