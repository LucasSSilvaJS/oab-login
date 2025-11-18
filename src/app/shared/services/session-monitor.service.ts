import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, firstValueFrom, Subject } from 'rxjs';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class SessionMonitorService implements OnDestroy {
  private monitorSub?: Subscription;
  private readonly checkInterval = 10000; // Verifica a cada 10 segundos
  private isChecking = false; // Flag para evitar verificações simultâneas
  
  // Emite quando a sessão foi desativada no backend
  readonly sessionDeactivated$ = new Subject<void>();

  constructor(
    private readonly apiService: ApiService,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Inicia o monitoramento da sessão
   */
  startMonitoring(): void {
    this.stopMonitoring();
    
    this.monitorSub = interval(this.checkInterval).subscribe(() => {
      this.checkSessionStatus();
    });
  }

  /**
   * Para o monitoramento da sessão
   */
  stopMonitoring(): void {
    this.monitorSub?.unsubscribe();
    this.monitorSub = undefined;
  }

  /**
   * Verifica o status da sessão na API
   */
  private async checkSessionStatus(): Promise<void> {
    // Evita verificações simultâneas
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      // Acessa localStorage diretamente para evitar dependência circular
      const token = localStorage.getItem('oab_token');
      const sessaoIdStr = localStorage.getItem('oab_sessao_id');
      const sessaoId = sessaoIdStr ? parseInt(sessaoIdStr, 10) : null;

      if (!token || !sessaoId) {
        // Se não há token ou sessão, para o monitoramento
        this.stopMonitoring();
        return;
      }

      // Busca informações da sessão atual
      const sessao = await firstValueFrom(
        this.apiService.getSessao(sessaoId, token)
      );

      // Se a sessão foi desativada no backend (ativado = false), finaliza a sessão
      if (sessao && sessao.ativado === false) {
        console.log('Sessão foi desativada no backend (ativado=false). Finalizando sessão e removendo token...');
        
        // Para o monitoramento antes de fazer logout para evitar loops
        this.stopMonitoring();
        
        // REMOVE O TOKEN IMEDIATAMENTE quando ativado = false
        localStorage.removeItem('oab_token');
        console.log('Token removido do localStorage');
        
        // Atualiza final_de_sessao se ainda não estiver preenchido (tenta com o token antigo, mas não bloqueia se falhar)
        if (!sessao.final_de_sessao) {
          try {
            const finalDeSessao = new Date().toISOString();
            await firstValueFrom(
              this.apiService.atualizarSessao(
                sessaoId,
                {
                  final_de_sessao: finalDeSessao,
                },
                token // Usa o token que ainda está em memória, mas já removemos do localStorage
              )
            );
            console.log('Final de sessão atualizado:', finalDeSessao);
          } catch (updateError) {
            console.error('Erro ao atualizar final_de_sessao (pode ser porque o token foi removido):', updateError);
            // Não bloqueia o logout mesmo se falhar
          }
        }
        
        // Notifica o usuário
        await this.notificationService.showNativeNotification(
          'Sessão Encerrada',
          'Sua sessão foi encerrada pelo administrador.',
          { tag: 'session-deactivated', requireInteraction: true }
        );
        
        // Emite evento para que o AuthService faça logout
        // O token já foi removido, então o logout será forçado
        this.sessionDeactivated$.next();
        return;
      }
    } catch (error: any) {
      // Se a sessão não foi encontrada (404), para o monitoramento
      const errorMessage = error?.message || error?.toString() || '';
      if (
        errorMessage.includes('404') || 
        errorMessage.includes('Não encontrado') ||
        errorMessage.includes('404 Not Found')
      ) {
        console.warn('Sessão não encontrada na API. Parando monitoramento.');
        this.stopMonitoring();
        return;
      }
      
      // Em caso de erro de rede ou outro erro, apenas loga e continua monitorando
      // Não faz logout automático em caso de erro de rede para evitar desconexões indevidas
      console.error('Erro ao verificar status da sessão:', error);
    } finally {
      this.isChecking = false;
    }
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}

