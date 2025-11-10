import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SharedModule } from '../../../../shared/shared.module';
import { PasswordPopupService } from '../../../../shared/services/password-popup.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class LoginPage {
  // Formulário reativo para melhor escalabilidade e testes
  readonly form = this.fb.group({
    oabNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{1,10}$/)]],
    securityCode: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(8)]],
  });

  isSubmitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly pwdPopup: PasswordPopupService
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    const { oabNumber, securityCode } = this.form.getRawValue();
    try {
      const success = await this.auth.login(oabNumber!, securityCode!);
      if (success) {
        await this.router.navigateByUrl('/home', { replaceUrl: true });
      } else {
        await this.presentToast('Credenciais inválidas. Tente novamente.');
      }
    } catch (err) {
      await this.presentToast('Erro ao autenticar. Verifique sua conexão.');
    } finally {
      this.isSubmitting = false;
    }
  }

  get oabNumberCtrl() {
    return this.form.controls.oabNumber;
  }
  get securityCodeCtrl() {
    return this.form.controls.securityCode;
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color: 'danger',
      position: 'top',
    });
    await toast.present();
  }

  exitApp(): void {
    // Abre popup de senha e, se correto, solicita saída ao Electron
    this.pwdPopup.open().then(async (password) => {
      if (!password) return;
      const ok: boolean = await (window as any).electronAPI?.verifyAdminPassword?.(password);
      if (ok) {
        (window as any).electronAPI?.exitApp?.();
      }
    });
  }
}


