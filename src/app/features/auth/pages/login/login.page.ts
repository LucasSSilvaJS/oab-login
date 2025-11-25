import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SharedModule } from '../../../../shared/shared.module';
import { PasswordPopupService } from '../../../../shared/services/password-popup.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { SessionTimerService } from '../../../../shared/services/session-timer.service';
import { SessionConfigService } from '../../../../shared/services/session-config.service';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule, LoadingOverlayComponent],
})
export class LoginPage {
  // Formulário reativo para melhor escalabilidade e testes
  readonly form = this.fb.group({
    oabNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{1,10}$/)]],
    securityCode: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(8)]],
  });

  isSubmitting = false;
  loadingMessage = 'Autenticando...';

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly pwdPopup: PasswordPopupService,
    private readonly notify: NotificationService,
    private readonly session: SessionTimerService,
    private readonly sessionConfig: SessionConfigService,
    private readonly cdr: ChangeDetectorRef
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
    this.loadingMessage = 'Autenticando...';
    this.cdr.markForCheck();
    
    const { oabNumber, securityCode } = this.form.getRawValue();
    try {
      // Simula diferentes etapas do login para feedback visual
      this.loadingMessage = 'Verificando credenciais...';
      this.cdr.markForCheck();
      
      await new Promise(resolve => setTimeout(resolve, 300)); // Pequeno delay para mostrar mensagem
      
      this.loadingMessage = 'Autenticando com servidor...';
      this.cdr.markForCheck();
      
      // O login já faz tudo: autentica, busca informações do usuário e cria a sessão
      await this.auth.login(oabNumber!, securityCode!);
      
      this.loadingMessage = 'Finalizando...';
      this.cdr.markForCheck();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Login bem-sucedido - verifica se o token foi salvo
      const tokenSalvo = localStorage.getItem('oab_token');
      const userInfoSalvo = localStorage.getItem('oab_user_info');
      console.log('🔍 Verificando dados após login:', { 
        token: !!tokenSalvo, 
        userInfo: !!userInfoSalvo 
      });
      
      if (!tokenSalvo) {
        console.error('❌ Token não foi salvo após login!');
        await this.notify.error('Erro: Token não foi salvo. Tente fazer login novamente.');
        return;
      }
      
      await this.notify.success('Sessão iniciada. Abrindo janela da sessão...');
      
      // Delay maior para garantir que o localStorage seja persistido
      // e compartilhado com a nova janela do Electron
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verifica novamente antes de abrir a janela
      const tokenAindaSalvo = localStorage.getItem('oab_token');
      console.log('🔍 Verificação final antes de abrir janela:', { token: !!tokenAindaSalvo });
      
      if (!tokenAindaSalvo) {
        console.error('❌ Token foi perdido!');
        await this.notify.error('Erro: Token não está disponível. Tente fazer login novamente.');
        return;
      }
      
      try {
        const api = (window as any).electronAPI;
        if (api?.startSessionWindow) {
          // Solicita ao Electron abrir a janela de sessão e fechar esta
          console.log('📡 Solicitando abertura da janela de sessão via Electron...');
          api.startSessionWindow();
        } else {
          // Fallback para ambiente sem Electron (ou se preload falhar)
          console.warn('[Fallback] electronAPI.startSessionWindow indisponível. Iniciando sessão local.');
          await this.router.navigateByUrl('/home', { replaceUrl: true });
        }
      } catch (e) {
        console.error('Falha ao iniciar janela de sessão:', e);
        await this.notify.info('Iniciando sessão nesta janela por segurança.');
        await this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    } catch (err: any) {
      // Tratamento de erros específicos da API baseado no status HTTP
      const errorStatus = err?.status;
      const errorMessage = err?.message || err?.error?.detail || 'Erro desconhecido';
      const errorTitle = err?.title || 'Erro';
      const errorDetail = err?.error?.detail || '';
      
      console.error('❌ Erro no login:', { 
        status: errorStatus, 
        message: errorMessage, 
        title: errorTitle,
        isSessionError: err?.isSessionError,
        error: err 
      });
      
      // PRIORIDADE 1: Verifica erros específicos de criação de sessão PRIMEIRO
      // Isso evita que erros de sessão sejam tratados como erros de conexão
      const isSessionError = err?.isSessionError || 
                             errorMessage.includes('criar a sessão') || 
                             errorMessage.includes('sessão no servidor') || 
                             errorMessage.includes('Erro ao criar sessão') || 
                             errorMessage.includes('Erro na Configuração') ||
                             errorMessage.includes('Configuração da Sessão') ||
                             errorMessage.includes('Não foi possível criar') ||
                             (errorStatus === 400 && (errorMessage.includes('computador') || errorMessage.includes('administrador') || errorMessage.includes('usuario')));
      
      if (isSessionError) {
        // Erro de criação de sessão - mostra alerta com título e mensagem específicos
        console.log('⚠️ Erro de sessão detectado. Mostrando mensagem específica.');
        await this.notify.alert(errorTitle || 'Erro na Criação da Sessão', errorMessage);
        return; // Retorna sem mostrar outras mensagens
      } 
      // PRIORIDADE 2: Verifica o status HTTP retornado pelo backend
      else if (errorStatus === 401) {
        // Credenciais inválidas (registro OAB ou código de segurança inválidos)
        await this.notify.error('Registro OAB ou código de segurança inválidos.');
      } else if (errorStatus === 403) {
        // Não adimplente
        await this.notify.error('Advogado não está adimplente com a OAB.');
      } 
      // PRIORIDADE 3: Erro de conexão (só se não for erro de sessão)
      else if (errorMessage.includes('conexão') || errorMessage.includes('network') || 
               errorMessage.includes('fetch') || !errorStatus || errorStatus === 0) {
        // Erro de conexão
        await this.notify.alert('Erro de conexão', 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else {
        // Outros erros
        await this.notify.alert(errorTitle || 'Falha na autenticação', errorMessage);
      }
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
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

  async openSessionConfig(): Promise<void> {
    // Verifica permissão de administrador do Windows via UAC (mesmo sistema usado ao fechar)
    const api = (window as any).electronAPI;
    if (!api?.requestWindowsAdminConsent) {
      await this.notify.error('Sistema de verificação de administrador não disponível.');
      return;
    }

    const hasPermission: boolean = await api.requestWindowsAdminConsent();
    if (!hasPermission) {
      await this.notify.info('Acesso negado. É necessário permissão de administrador do Windows.');
      return;
    }

    // Abre o popup de configuração de sessão
    const config = await this.sessionConfig.open();
    if (config) {
      await this.notify.success('Configuração de sessão salva com sucesso!');
    }
  }
}


