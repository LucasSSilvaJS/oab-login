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
        // Tenta recuperar informações do usuário do localStorage
        const userInfo = this.auth.getUserInfo();
        console.log('Informações do usuário recuperadas do localStorage:', userInfo);
        if (userInfo) {
          const userName = userInfo.nome || userInfo.registro_oab || 'Usuário';
          const oabNumber = userInfo.registro_oab || '---';
          console.log('Iniciando sessão com:', { userName, oabNumber });
          this.session.start({
            userName: userName,
            oabNumber: oabNumber,
            totalSeconds: 6 * 60, // 6 minutos para teste
          });
        } else {
          console.warn('Informações do usuário não encontradas. Usando fallback.');
          // Fallback caso não tenha informações do usuário
          this.session.start({ userName: 'Usuário', oabNumber: '---', totalSeconds: 6 * 60 }); // 6 minutos para teste
        }
      }
    };
  }
}
