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
      
      const response = await firstValueFrom(
        this.apiService.loginAdvogado(loginPayload)
      );
      
      console.log('✅ Resposta recebida do backend:', response);

      // Salva o token JWT
      localStorage.setItem(this.tokenKey, response.access_token);
      console.log('✅ Token JWT armazenado no localStorage');

      // Armazena o usuario_id do login para uso posterior
      const usuarioId = response.usuario_id;
      console.log('✅ Login realizado. Usuario ID:', usuarioId);
      console.log('✅ Resposta completa do backend:', response);

      // O backend já retorna nome e cadastro_id na resposta do login
      // Usa diretamente os dados da resposta, sem necessidade de chamada adicional
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

      // PRIMEIRO: Tenta criar sessão na API
      // Se falhar com erro específico de "sessão não ativa" (primeiro acesso), permite continuar
      let sessaoCriada = false;
      try {
        console.log('🔄 Tentando criar sessão na API...');
        sessaoCriada = await this.criarSessaoNaAPI(response.access_token, response.usuario_id);

        if (sessaoCriada) {
          console.log('✅ Sessão criada com sucesso. Prosseguindo com o login...');
        } else {
          console.warn('⚠️ Sessão não foi criada (retornou false), mas continuando login...');
        }
      } catch (error: any) {
        console.error('❌ Erro ao criar sessão na API:');
        console.error('   Tipo do erro:', error?.constructor?.name);
        console.error('   Mensagem:', error?.message);
        console.error('   Status:', error?.status);
        console.error('   Status Text:', error?.statusText);
        console.error('   Erro completo:', JSON.stringify(error, null, 2));

        // Verifica se é erro 401 relacionado a sessão não ativa
        // Isso acontece no primeiro login quando o backend verifica sessão ativa antes de permitir criar
        if (error?.status === 401) {
          const errorDetail = error?.error?.detail || error?.message || '';
          if (errorDetail.includes('Sessão não ativa') || errorDetail.includes('sessão não ativa') || errorDetail.includes('Autenticação negada')) {
            console.warn('⚠️ Backend está verificando sessão ativa antes de criar. Isso é esperado no primeiro login.');
            console.warn('⚠️ Continuando login mesmo sem criar sessão (primeiro acesso - será criada depois)');
            // Permite o login continuar - a sessão será criada depois ou o backend pode criar automaticamente
            sessaoCriada = false; // Não bloqueia o login
          } else {
            // Outro tipo de erro 401 - bloqueia o login
            console.error('❌ Erro 401 não relacionado a sessão não ativa. Bloqueando login.');
            this.limparDadosLogin();
            throw new Error('Não autorizado para criar sessão. Verifique suas credenciais.');
          }
        } else {
          // Para erros 400 (Bad Request), não bloqueia o login - pode ser problema de configuração
          // que será resolvido depois
          if (error?.status === 400) {
            console.warn('⚠️ Erro 400 ao criar sessão (Bad Request). Continuando login...');
            console.warn('⚠️ Detalhes do erro:', error?.error?.detail || error?.message);
            console.warn('⚠️ Isso pode indicar que faltam configurações (computador_id, administrador_id)');
            sessaoCriada = false; // Não bloqueia o login
          } else {
            // Para outros erros críticos, bloqueia o login
            console.error('❌ Erro ao criar sessão. Bloqueando login.');
            this.limparDadosLogin();

            // Cria mensagem de erro mais amigável
            let errorMessage = 'Erro ao criar sessão no servidor.';

            if (error?.status === 403) {
              errorMessage = 'Acesso negado para criar sessão.';
            } else if (error?.status === 500) {
              errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
            } else if (error?.message) {
              errorMessage = error.message;
            } else if (error?.error?.detail) {
              errorMessage = error.error.detail;
            }

            throw new Error(errorMessage);
          }
        }
      }

      // Se a sessão não foi criada, tenta criar novamente após um pequeno delay
      // Isso resolve o problema de verificação circular no backend (precisa de sessão ativa para criar sessão)
      if (!sessaoCriada) {
        console.warn('⚠️ Sessão não foi criada no primeiro login. Tentando novamente após delay...');
        // Aguarda um pouco e tenta criar novamente
        setTimeout(async () => {
          try {
            console.log('🔄 Tentando criar sessão novamente após delay...');
            const retrySuccess = await this.criarSessaoNaAPI(response.access_token, response.usuario_id);
            if (retrySuccess) {
              console.log('✅ Sessão criada com sucesso na segunda tentativa!');
            } else {
              console.warn('⚠️ Sessão ainda não foi criada na segunda tentativa. Continuando mesmo assim.');
            }
          } catch (retryError: any) {
            console.warn('⚠️ Erro ao tentar criar sessão novamente:', retryError?.message);
            // Não bloqueia o login, apenas loga o aviso
          }
        }, 2000); // Aguarda 2 segundos antes de tentar novamente
      }

      // Se chegou aqui, pode prosseguir com o login (sessão criada ou será criada depois)
      // Agora inicia a sessão local
      console.log('Iniciando timer da sessão com:', { userName, oabNumber });
      this.sessionTimer.start({
        userName: userName,
        oabNumber: oabNumber,
        totalSeconds: 6 * 60, // 6 minutos para teste
      });
      console.log('Timer da sessão iniciado com sucesso');

      // Se inscreve para finalizar sessão quando o timer expirar
      this.subscribeToSessionExpiration();

      return true;
    } catch (error: any) {
      console.error('Erro no login:', error);
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
  private async criarSessaoNaAPI(token: string, usuarioId: number): Promise<boolean> {
    try {
      console.log('🚀 Iniciando criação de sessão na API...', { usuarioId, tokenPresent: !!token });

      // Obtém configuração de sessão
      const sessionConfigStr = localStorage.getItem('session_config');
      if (!sessionConfigStr) {
        console.error('❌ Configuração de sessão não encontrada. Criando configuração padrão...');
        // Cria configuração padrão se não existir
        const defaultConfig = {
          usuario_id: usuarioId,
          computador_id: 0,
          administrador_id: 0,
        };
        localStorage.setItem('session_config', JSON.stringify(defaultConfig));
        console.log('✅ Configuração padrão criada:', defaultConfig);
      }

      const sessionConfig = JSON.parse(sessionConfigStr || '{}');
      // Usa os valores da configuração ou 0 como padrão
      const computadorId = sessionConfig.computador_id ?? 0;
      const administradorId = sessionConfig.administrador_id ?? 0;

      console.log('📋 Configuração de sessão:', { computadorId, administradorId, usuarioId });

      // Calcula data/hora de início (TEMPO ATUAL)
      const inicioDeSessao = new Date().toISOString();

      // Calcula data/hora de fim (6 minutos depois para teste)
      const finalDeSessao = new Date(Date.now() + 6 * 60 * 1000).toISOString();

      // Data no formato YYYY-MM-DD
      const data = new Date().toISOString().split('T')[0];

      // Prepara payload da sessão
      // Se computador_id ou administrador_id são 0, pode ser que o backend não aceite
      // Vamos tentar omitir esses campos se forem 0
      const sessaoCreate: any = {
        data: data,
        inicio_de_sessao: inicioDeSessao,
        final_de_sessao: finalDeSessao,
        ativado: true, // Flag ativado como true ao criar
        usuario_id: usuarioId,
      };
      
      // Só adiciona computador_id e administrador_id se forem diferentes de 0
      // Alguns backends não aceitam 0, então vamos omitir se for 0
      if (computadorId && computadorId !== 0) {
        sessaoCreate.computador_id = computadorId;
      }
      if (administradorId && administradorId !== 0) {
        sessaoCreate.administrador_id = administradorId;
      }

      console.log('📦 Payload da sessão a ser enviado:', JSON.stringify(sessaoCreate, null, 2));
      console.log('⚠️ AVISO: computador_id =', computadorId, 'administrador_id =', administradorId);
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
        // Se a requisição falhou, loga detalhes e relança
        console.error('❌ Erro na requisição de criação de sessão:', requestError);
        console.error('   Status:', requestError?.status);
        console.error('   Mensagem:', requestError?.message);
        console.error('   Erro completo:', requestError);
        throw requestError;
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
        return true; // Retorna true indicando sucesso
      } else {
        // Se não tem ID, mas a resposta existe, pode ser que a API retornou sucesso de outra forma
        console.warn('⚠️ Resposta não contém sessao_id, mas pode ter sido criada. Resposta:', sessaoResponse);
        // Verifica se tem outros campos que indicam sucesso
        if (sessaoResponse.ativado !== undefined || sessaoResponse.data) {
          console.log('✅ Resposta indica que a sessão foi criada (campos presentes)');
          // Tenta obter o ID de outra forma ou assume sucesso
          return true;
        }
        console.error('❌ Sessão criada mas não retornou sessao_id. Resposta completa:', JSON.stringify(sessaoResponse, null, 2));
        throw new Error('Resposta do servidor não contém ID da sessão criada');
      }
    } catch (error: any) {
      console.error('❌ ERRO ao criar sessão na API:');
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

      // Propaga o erro para que o login seja cancelado
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
            // Fallback: tenta usar window.location se o router falhar
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
          }
        },
        (error) => {
          console.error('Erro ao navegar para login:', error);
          // Fallback: tenta usar window.location se o router falhar
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
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


