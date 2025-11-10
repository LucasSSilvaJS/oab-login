import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SharedModule } from '../../../../shared/shared.module';
import { PasswordPopupService } from '../../../../shared/services/password-popup.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { SessionTimerService } from '../../../../shared/services/session-timer.service';

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
    securityCode: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(8)]],
  });

  isSubmitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly pwdPopup: PasswordPopupService,
    private readonly notify: NotificationService,
    private readonly session: SessionTimerService
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      // Feedback imediato (heurística de visibilidade do status do sistema)
      const messages: string[] = [];
      if (this.oabNumberCtrl.invalid) messages.push('Informe um Nº da OAB válido (apenas números).');
      if (this.securityCodeCtrl.invalid) messages.push('Código de segurança precisa de 3 a 8 caracteres.');
      await this.notify.info(messages.join(' '));
      return;
    }
    this.isSubmitting = true;
    const { oabNumber, securityCode } = this.form.getRawValue();
    try {
      const success = await this.auth.login(oabNumber!, securityCode!);
      if (success) {
        // Não navega para outra tela; apenas mostra o overlay com contador
        await this.notify.success('Sessão iniciada. Abrindo janela da sessão...');
        try {
          const api = (window as any).electronAPI;
          if (api?.startSessionWindow) {
            // Solicita ao Electron abrir a janela de sessão e fechar esta
            api.startSessionWindow();
          } else {
            // Fallback para ambiente sem Electron (ou se preload falhar)
            console.warn('[Fallback] electronAPI.startSessionWindow indisponível. Iniciando sessão local.');
            if (!this.session.isActive) {
              this.session.start({ userName: 'Gustavo', oabNumber: '123', totalSeconds: 30 * 60 });
            }
            await this.router.navigateByUrl('/home', { replaceUrl: true });
          }
        } catch (e) {
          console.error('Falha ao iniciar janela de sessão:', e);
          await this.notify.info('Iniciando sessão nesta janela por segurança.');
          if (!this.session.isActive) {
            this.session.start({ userName: 'Gustavo', oabNumber: '123', totalSeconds: 30 * 60 });
          }
          await this.router.navigateByUrl('/home', { replaceUrl: true });
        }
      } else {
        // Erro específico (correspondência com o mundo real + prevenção de erro)
        await this.notify.error('Credenciais inválidas. Dica: use OAB 123 e código 123.');
      }
    } catch (err) {
      await this.notify.alert('Falha na autenticação', 'Não foi possível completar o login. Verifique sua conexão.');
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


