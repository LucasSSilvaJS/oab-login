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
    // NOTA: O timer já foi iniciado durante o login no AuthService.
    // Esta função apenas verifica se o timer está ativo e, se não estiver, tenta recuperar do localStorage.
    (window as any).__START_SESSION__ = () => {
      // Se o timer já está ativo, não faz nada (evita reiniciar)
      if (this.session.isActive) {
        console.log('Timer já está ativo. Nada a fazer.');
        return;
      }
      
      // Tenta recuperar informações do usuário do localStorage
      const userInfo = this.auth.getUserInfo();
      console.log('Informações do usuário recuperadas do localStorage:', userInfo);
      
      if (userInfo) {
        const userName = userInfo.nome || userInfo.registro_oab || 'Usuário';
        const oabNumber = userInfo.registro_oab || '---';
        console.log('Iniciando sessão com:', { userName, oabNumber });
        // NOTA: totalSeconds deve ser recuperado da configuração de sessão ou usar valor padrão
        // Por enquanto, usa valor fixo, mas idealmente deveria vir do backend ou configuração
        this.session.start({
          userName: userName,
          oabNumber: oabNumber,
          totalSeconds: 6 * 60, // 6 minutos para teste - TODO: obter da API ou configuração
        });
      } else {
        console.warn('Informações do usuário não encontradas. Timer não será iniciado.');
        // Não inicia timer sem informações válidas do usuário
      }
    };
  }
}
