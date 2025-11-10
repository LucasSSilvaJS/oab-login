import { Component } from '@angular/core';
import { PasswordPopupService } from '../shared/services/password-popup.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  constructor(private readonly pwdPopup: PasswordPopupService) {}

  exitApp(): void {
    this.pwdPopup.open().then(async (password) => {
      if (!password) return;
      const ok: boolean = await (window as any).electronAPI?.verifyAdminPassword?.(password);
      if (ok) {
        (window as any).electronAPI?.exitApp?.();
      }
    });
  }
}
