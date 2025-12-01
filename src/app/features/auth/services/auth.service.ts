import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { SessionTimerService } from '../../../shared/services/session-timer.service';
import { ApiService } from '../../../shared/services/api.service';
import { NotificationService } from '../../../shared/services/notification.service';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private tokenKey = 'oab_token';
  private userInfoKey = 'oab_user_info';
  private sessaoIdKey = 'oab_sessao_id';
  private sessionExpiredSub?: Subscription;

  constructor(
    private readonly sessionTimer: SessionTimerService,
    private readonly router: Router,
    private readonly apiService: ApiService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnDestroy(): void {
    this.sessionExpiredSub?.unsubscribe();
  }

  async login(oabNumber: string, securityCode: string): Promise<boolean> {
    // Limpa dados anteriores antes de começar
    this.limparDadosLogin();
    
    try {
      // Normaliza os dados para garantir formato correto
      // registro_oab: apenas números, sem espaços
      const registroOabNormalizado = String(oabNumber || '').trim();
      // codigo_de_seguranca: string, sem espaços
      const codigoSegurancaNormalizado = String(securityCode || '').trim();
      
      console.log('═══════════════════════════════════════');
      console.log('🚀 INICIANDO LOGIN');
      console.log('═══════════════════════════════════════');
      console.log('📝 OAB original:', oabNumber);
      console.log('📝 OAB normalizado:', registroOabNormalizado);
      console.log('🔑 Código:', codigoSegurancaNormalizado ? '***' : '(vazio)');
      console.log('═══════════════════════════════════════');
      
      // Prepara payload exatamente como o backend espera
      const loginPayload = {
        registro_oab: registroOabNormalizado,
        codigo_de_seguranca: codigoSegurancaNormalizado,
      };
      
      console.log('📦 Payload a ser enviado:', JSON.stringify(loginPayload, null, 2));
      
      // PASSO 1: Autentica o usuário (obtém token e dados)
      // NÃO salva ainda - apenas obtém as informações necessárias
      const response = await firstValueFrom(
        this.apiService.loginAdvogado(loginPayload)
      );
      
      console.log('✅ Resposta recebida do backend:', response);

      // Armazena temporariamente o usuario_id e token (ainda não salva no localStorage)
      const usuarioId = response.usuario_id;
      const accessToken = response.access_token;
      console.log('✅ Autenticação bem-sucedida. Usuario ID:', usuarioId);

      // PASSO 2: CRIA A SESSÃO ANTES DE SALVAR DADOS
      // Se a criação da sessão falhar, impede o login completamente
      console.log('🔄 Criando sessão na API ANTES de completar o login...');
      try {
        await this.criarSessaoNaAPI(accessToken, usuarioId);
        console.log('✅ Sessão criada com sucesso! Prosseguindo com o login...');
      } catch (sessionError: any) {
        // Se a criação da sessão falhar, limpa tudo e impede o login
        console.error('❌ Erro ao criar sessão. IMPEDINDO LOGIN.');
        console.error('   Tipo do erro:', sessionError?.constructor?.name);
        console.error('   Mensagem:', sessionError?.message);
        console.error('   Status:', sessionError?.status);
        console.error('   Erro completo:', sessionError);
        
        // Limpa qualquer dado que possa ter sido salvo antes
        this.limparDadosLogin();
        
        // Cria mensagem de erro específica baseada no tipo de erro
        let errorMessage = 'Erro ao criar sessão no servidor.';
        let errorTitle = 'Erro na Criação da Sessão';
        
        if (sessionError?.status === 400) {
          errorTitle = 'Erro na Configuração da Sessão';
          const errorDetail = sessionError?.error?.detail || sessionError?.message || 'Dados inválidos';
          errorMessage = `Não foi possível criar a sessão: ${errorDetail}. Verifique a configuração na seção "Configurar Sessão".`;
        } else if (sessionError?.status === 401) {
          errorTitle = 'Não Autorizado';
          errorMessage = 'Não foi possível criar a sessão. Credenciais inválidas ou expiradas.';
        } else if (sessionError?.status === 403) {
          errorTitle = 'Acesso Negado';
          errorMessage = 'Acesso negado para criar sessão. Verifique suas permissões.';
        } else if (sessionError?.status === 500) {
          errorTitle = 'Erro do Servidor';
          errorMessage = 'Erro interno do servidor ao criar sessão. Tente novamente mais tarde.';
        } else if (sessionError?.message) {
          errorMessage = sessionError.message;
        } else if (sessionError?.error?.detail) {
          errorMessage = sessionError.error.detail;
        }
        
        // Marca como erro de sessão para ser tratado corretamente no componente
        const enhancedError: any = new Error(errorMessage);
        enhancedError.isSessionError = true;
        enhancedError.status = sessionError?.status;
        enhancedError.title = errorTitle;
        enhancedError.originalError = sessionError;
        
        // Lança o erro para impedir o login
        throw enhancedError;
      }

      // PASSO 3: Se chegou aqui, a sessão foi criada com sucesso
      // Agora pode salvar os dados do usuário e completar o login
      
      // Salva o token JWT
      localStorage.setItem(this.tokenKey, accessToken);
      console.log('✅ Token JWT armazenado no localStorage');

      // O backend já retorna nome e cadastro_id na resposta do login
      const userName = response.nome || oabNumber;
      console.log('✅ Nome do usuário:', userName);

      // Armazena informações do usuário usando dados da resposta do login
      const userInfoData = {
        usuario_id: response.usuario_id,
        registro_oab: oabNumber,
        tipo_usuario: response.tipo_usuario,
        nome: userName,
        cadastro_id: response.cadastro_id,
        email: null, // Email não vem na resposta do login, apenas na consulta completa
      };

      console.log('✅ Dados do usuário preparados para armazenamento:', userInfoData);

      // Salva informações do usuário no localStorage
      localStorage.setItem(this.userInfoKey, JSON.stringify(userInfoData));
      console.log('Informações do usuário salvas no localStorage');

      // Atualiza ou cria a configuração de sessão com o usuario_id
      const sessionConfigStr = localStorage.getItem('session_config');
      if (sessionConfigStr) {
        try {
          const sessionConfig = JSON.parse(sessionConfigStr);
          sessionConfig.usuario_id = response.usuario_id;
          localStorage.setItem('session_config', JSON.stringify(sessionConfig));
        } catch (error) {
          console.warn('Erro ao atualizar configuração de sessão:', error);
          // Se houver erro ao ler, cria uma nova configuração apenas com usuario_id
          localStorage.setItem('session_config', JSON.stringify({
            usuario_id: response.usuario_id,
            computador_id: 0,
            administrador_id: 0,
          }));
        }
      } else {
        // Se não existe configuração, cria uma básica com o usuario_id
        localStorage.setItem('session_config', JSON.stringify({
          usuario_id: response.usuario_id,
          computador_id: 0,
          administrador_id: 0,
        }));
      }

      // PASSO 4: Inicia a sessão local (timer)
      console.log('Iniciando timer da sessão com:', { userName, oabNumber });
      this.sessionTimer.start({
        userName: userName,
        oabNumber: oabNumber,
        totalSeconds: 30 * 60, // 30 minutos
      });
      console.log('Timer da sessão iniciado com sucesso');

      // Se inscreve para finalizar sessão quando o timer expirar
      this.subscribeToSessionExpiration();

      return true;
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      // Se não for erro de sessão já tratado, limpa dados
      if (!error.isSessionError) {
        this.limparDadosLogin();
      }
      throw error; // Propaga o erro para ser tratado no componente
    }
  }

  async logout(): Promise<void> {
    // Cancela inscrição de expiração
    this.sessionExpiredSub?.unsubscribe();
    this.sessionExpiredSub = undefined;

    const token = this.getToken();
    const sessaoId = this.getSessaoId();

    // Finaliza a sessão na API se existir
    if (token && sessaoId) {
      try {
        console.log('Finalizando sessão:', { sessaoId });

        // Calcula o tempo final (HORA ATUAL)
        const finalDeSessao = new Date().toISOString();
        console.log('Tempo final da sessão:', finalDeSessao);

        // Tenta usar o endpoint POST /finalizar primeiro
        try {
          const response = await firstValueFrom(
            this.apiService.finalizarSessao(sessaoId, token)
          );
          console.log('✅ Sessão finalizada com sucesso via endpoint /finalizar:', response);
        } catch (finalizarError) {
          console.warn('Endpoint /finalizar falhou, tentando atualizar manualmente...', finalizarError);

          // Fallback: atualiza manualmente com PUT
          await firstValueFrom(
            this.apiService.atualizarSessao(
              sessaoId,
              {
                final_de_sessao: finalDeSessao, // Hora atual
                ativado: false, // Flag ativado como false ao encerrar
              },
              token
            )
          );

          console.log('✅ Sessão atualizada manualmente com sucesso:', {
            final_de_sessao: finalDeSessao,
            ativado: false
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao finalizar sessão na API:', error);
        console.error('Detalhes do erro:', error.message || error);
        if (error.error) {
          console.error('Erro do servidor:', error.error);
        }
        // Continua com o logout mesmo se houver erro
      }
    } else {
      console.warn('Token ou sessaoId não encontrados. Sessão não será finalizada na API.');
      console.warn('Token presente:', !!token, 'SessaoId presente:', !!sessaoId);
    }

    // Remove o token e todos os dados de sessão
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userInfoKey);
    localStorage.removeItem(this.sessaoIdKey);
    console.log('Token e dados de sessão removidos do localStorage');

    this.sessionTimer.stop();
    // Garante retorno à tela inicial de login
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUserInfo(): any {
    const userInfoStr = localStorage.getItem(this.userInfoKey);
    return userInfoStr ? JSON.parse(userInfoStr) : null;
  }

  getSessaoId(): number | null {
    const sessaoIdStr = localStorage.getItem(this.sessaoIdKey);
    return sessaoIdStr ? parseInt(sessaoIdStr, 10) : null;
  }

  /**
   * Limpa todos os dados de login em caso de erro
   */
  private limparDadosLogin(): void {
    console.log('🧹 Limpando dados de login...');
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userInfoKey);
    localStorage.removeItem(this.sessaoIdKey);
    // Não remove session_config pois pode ser útil para tentar novamente
    console.log('✅ Dados de login limpos');
  }

  /**
   * Cria sessão na API
   * @returns true se a sessão foi criada com sucesso, false caso contrário
   * @throws Error se houver erro na requisição
   */
  private async criarSessaoNaAPI(token: string, usuarioId: number): Promise<void> {
    // Variáveis para uso no tratamento de erro
    let computadorId = 0;
    let administradorId = 0;
    
    try {
      console.log('🚀 Iniciando criação de sessão na API...', { usuarioId, tokenPresent: !!token });

      // Obtém configuração de sessão
      const sessionConfigStr = localStorage.getItem('session_config');
      if (!sessionConfigStr) {
        console.warn('⚠️ Configuração de sessão não encontrada. Usando valores padrão...');
        // Usa valores padrão se não existir configuração
        computadorId = 0;
        administradorId = 0;
      } else {
        try {
          const sessionConfig = JSON.parse(sessionConfigStr);
          // Usa os valores da configuração ou 0 como padrão
          computadorId = sessionConfig.computador_id ?? 0;
          administradorId = sessionConfig.administrador_id ?? 0;
        } catch (parseError) {
          console.warn('⚠️ Erro ao ler configuração de sessão. Usando valores padrão...');
          computadorId = 0;
          administradorId = 0;
        }
      }

      console.log('📋 Configuração de sessão:', { computadorId, administradorId, usuarioId });

      // Calcula data/hora de início (TEMPO ATUAL)
      const inicioDeSessao = new Date().toISOString();

      // Calcula data/hora de fim (30 minutos depois)
      const finalDeSessao = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Data no formato YYYY-MM-DD
      const data = new Date().toISOString().split('T')[0];

      // Prepara payload da sessão conforme especificação da API
      const sessaoCreate: any = {
        data: data,
        inicio_de_sessao: inicioDeSessao,
        final_de_sessao: finalDeSessao,
        ativado: true,
        computador_id: computadorId,
        usuario_id: usuarioId,
        administrador_id: administradorId,
        analista_ids: [0], // Campo obrigatório conforme especificação
      };

      console.log('📦 Payload da sessão a ser enviado:', JSON.stringify(sessaoCreate, null, 2));
      console.log('🌐 URL da API:', 'https://backend-oab.onrender.com/api/v1/sessoes');
      console.log('📤 Enviando requisição POST para criar sessão...');
      console.log('🔑 Token presente:', !!token);
      if (token) {
        console.log('🔑 Token (primeiros 30 chars):', token.substring(0, 30) + '...');
      }

      // Faz a requisição
      let sessaoResponse: any;
      try {
        sessaoResponse = await firstValueFrom(
          this.apiService.criarSessao(sessaoCreate, token)
        );
        console.log('📥 Resposta da criação de sessão recebida:', sessaoResponse);
      } catch (requestError: any) {
        // Se a requisição falhou, loga detalhes e cria erro específico
        console.error('❌ Erro na requisição de criação de sessão:', requestError);
        console.error('   Status:', requestError?.status);
        console.error('   Mensagem:', requestError?.message);
        console.error('   Erro completo:', requestError);
        
        // Prepara mensagem de erro específica baseada no tipo de erro
        const errorDetail = requestError?.error?.detail || requestError?.message || '';
        const errorDetailLower = errorDetail.toLowerCase();
        
        let mensagemErro = '';
        
        if (requestError?.status === 400) {
          // Erro 400: Bad Request - geralmente é problema de configuração
          if (errorDetailLower.includes('computador') || errorDetailLower.includes('computer')) {
            mensagemErro = `ID do Computador inválido (${computadorId}). Verifique a configuração na seção "Configurar Sessão".`;
            console.error('❌ ID do Computador inválido:', computadorId);
          } else if (errorDetailLower.includes('administrador') || errorDetailLower.includes('admin')) {
            mensagemErro = `ID do Administrador inválido (${administradorId}). Verifique a configuração na seção "Configurar Sessão".`;
            console.error('❌ ID do Administrador inválido:', administradorId);
          } else if (errorDetailLower.includes('usuario') || errorDetailLower.includes('usuário') || errorDetailLower.includes('user')) {
            mensagemErro = `ID do Usuário inválido (${usuarioId}). Verifique as credenciais.`;
            console.error('❌ ID do Usuário inválido:', usuarioId);
          } else {
            mensagemErro = `Erro ao criar sessão: ${errorDetail || 'Dados inválidos'}. Verifique a configuração na seção "Configurar Sessão".`;
          }
        } else if (requestError?.status === 401) {
          mensagemErro = 'Não autorizado para criar sessão. Token inválido ou expirado.';
        } else if (requestError?.status === 403) {
          mensagemErro = 'Acesso negado para criar sessão. Verifique suas permissões.';
        } else if (requestError?.status === 500) {
          mensagemErro = 'Erro interno do servidor ao criar sessão. Tente novamente mais tarde.';
        } else {
          mensagemErro = errorDetail || requestError?.message || 'Erro desconhecido ao criar sessão.';
        }
        
        // Cria erro aprimorado com informações detalhadas
        const enhancedError: any = new Error(mensagemErro);
        enhancedError.status = requestError?.status;
        enhancedError.error = requestError?.error;
        enhancedError.originalError = requestError;
        
        // Lança o erro (não retorna false)
        throw enhancedError;
      }

      // Verifica se a resposta é válida
      if (!sessaoResponse) {
        console.error('❌ Resposta vazia da API');
        throw new Error('Resposta vazia do servidor ao criar sessão');
      }

      // Verifica se tem sessao_id (pode ter nomes diferentes na resposta)
      const sessaoId = sessaoResponse.sessao_id || sessaoResponse.id || sessaoResponse.session_id;

      if (sessaoId) {
        localStorage.setItem(this.sessaoIdKey, sessaoId.toString());
        console.log('✅ Sessão criada na API com sucesso! ID da sessão:', sessaoId);
        return; // Sucesso - não retorna nada (void)
      } else {
        // Se não tem ID, mas a resposta existe, verifica se tem outros campos que indicam sucesso
        console.warn('⚠️ Resposta não contém sessao_id, mas pode ter sido criada. Resposta:', sessaoResponse);
        // Verifica se tem outros campos que indicam sucesso
        if (sessaoResponse.ativado !== undefined || sessaoResponse.data) {
          console.log('✅ Resposta indica que a sessão foi criada (campos presentes)');
          // Se não tem sessao_id mas tem outros campos, tenta usar um ID padrão ou continua
          console.warn('⚠️ Sessão criada mas sem sessao_id. Continuando...');
          return; // Assume sucesso
        }
        console.error('❌ Sessão não retornou sessao_id nem campos de confirmação. Resposta completa:', JSON.stringify(sessaoResponse, null, 2));
        throw new Error('Resposta do servidor não contém ID da sessão criada');
      }
    } catch (error: any) {
      console.error('❌ ERRO ao criar sessão na API (final):');
      console.error('   Tipo do erro:', error?.constructor?.name || typeof error);
      console.error('   Mensagem:', error?.message || 'Sem mensagem');
      console.error('   Stack:', error?.stack || 'Sem stack');

      if (error?.error) {
        console.error('   Erro do servidor:', error.error);
        if (typeof error.error === 'object') {
          console.error('   Detalhes do servidor:', JSON.stringify(error.error, null, 2));
        }
      }

      if (error?.status) {
        console.error('   Status HTTP:', error.status);
      }

      if (error?.statusText) {
        console.error('   Status Text:', error.statusText);
      }

      // Sempre lança o erro (não retorna false)
      throw error;
    }
  }

  private subscribeToSessionExpiration(): void {
    // Cancela inscrição anterior se existir
    this.sessionExpiredSub?.unsubscribe();

    // Se inscreve para finalizar sessão quando o timer expirar
    this.sessionExpiredSub = this.sessionTimer.sessionExpired$.subscribe(() => {
      this.finalizarSessaoNaAPI();
    });
  }

  /**
   * Força logout quando a sessão não está ativa no backend
   * Chamado pelo interceptor HTTP quando detecta erro 401 relacionado a sessão inativa
   */
  forceLogoutOnSessionInactive(): void {
    console.log('Sessão não está ativa no backend. Forçando logout...');

    // Para o timer imediatamente
    this.sessionTimer.stop();
    console.log('Timer parado');

    // Cancela inscrição de expiração
    this.sessionExpiredSub?.unsubscribe();
    this.sessionExpiredSub = undefined;
    console.log('Inscrições canceladas');

    // Remove TODOS os dados de sessão (token já foi removido pelo interceptor)
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userInfoKey);
    localStorage.removeItem(this.sessaoIdKey);
    console.log('Dados de sessão removidos do localStorage');

    // Notifica o usuário
    this.notificationService.showNativeNotification(
      'Sessão Encerrada',
      'Sua sessão foi encerrada pelo administrador.',
      { tag: 'session-deactivated', requireInteraction: true }
    );

    // Força navegação para login
    // Usa setTimeout para garantir que a navegação aconteça após a remoção dos dados
    setTimeout(() => {
      console.log('Redirecionando para /auth/login...');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true }).then(
        (success) => {
          if (success) {
            console.log('Redirecionamento concluído com sucesso');
          } else {
            console.warn('Navegação não foi bem-sucedida, tentando fallback...');
            // Fallback: usa hash routing corretamente (useHash: true)
            if (typeof window !== 'undefined') {
              window.location.hash = '#/auth/login';
              // Força reload se necessário
              setTimeout(() => {
                if (window.location.hash !== '#/auth/login') {
                  window.location.reload();
                }
              }, 100);
            }
          }
        },
        (error) => {
          console.error('Erro ao navegar para login:', error);
          // Fallback: usa hash routing corretamente (useHash: true)
          if (typeof window !== 'undefined') {
            window.location.hash = '#/auth/login';
            // Força reload se necessário
            setTimeout(() => {
              if (window.location.hash !== '#/auth/login') {
                window.location.reload();
              }
            }, 100);
          }
        }
      );
    }, 200);
  }

  private async finalizarSessaoNaAPI(): Promise<void> {
    const token = this.getToken();
    const sessaoId = this.getSessaoId();

    if (token && sessaoId) {
      try {
        console.log('Finalizando sessão por expiração do timer:', { sessaoId });

        // Calcula o tempo final (HORA ATUAL)
        const finalDeSessao = new Date().toISOString();
        console.log('Tempo final da sessão (expiração):', finalDeSessao);

        // Tenta usar o endpoint POST /finalizar primeiro
        try {
          const response = await firstValueFrom(
            this.apiService.finalizarSessao(sessaoId, token)
          );
          console.log('✅ Sessão finalizada por expiração com sucesso via endpoint /finalizar:', response);
        } catch (finalizarError) {
          console.warn('Endpoint /finalizar falhou, tentando atualizar manualmente...', finalizarError);

          // Fallback: atualiza manualmente com PUT
          await firstValueFrom(
            this.apiService.atualizarSessao(
              sessaoId,
              {
                final_de_sessao: finalDeSessao, // Hora atual
                ativado: false, // Flag ativado como false ao encerrar
              },
              token
            )
          );
          console.log('✅ Sessão atualizada manualmente por expiração:', {
            final_de_sessao: finalDeSessao,
            ativado: false
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao finalizar sessão na API por expiração:', error);
        console.error('Detalhes do erro:', error.message || error);
        if (error.error) {
          console.error('Erro do servidor:', error.error);
        }
      }
    } else {
      console.warn('Token ou sessaoId não encontrados. Sessão não será finalizada por expiração.');
    }
  }
}


