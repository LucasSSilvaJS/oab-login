import { Component } from '@angular/core';
import { PasswordPopupService } from './shared/services/password-popup.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private readonly pwdPopup: PasswordPopupService) {
    // Função global usada pelo processo principal (Electron) para solicitar a senha ao fechar
    (window as any).__REQUEST_ADMIN_PASSWORD__ = async () => {
      const password = await this.pwdPopup.open();
      if (!password) return false;
      const ok: boolean = await (window as any).electronAPI?.verifyAdminPassword?.(password);
      return !!ok;
    };
  }
}
