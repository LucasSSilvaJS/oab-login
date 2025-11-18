import { ApplicationRef, ComponentRef, Injectable, createComponent, EnvironmentInjector } from '@angular/core';
import { SessionConfigPopupComponent, SessionConfig } from '../components/session-config-popup/session-config-popup.component';

@Injectable({ providedIn: 'root' })
export class SessionConfigService {
  private current?: ComponentRef<SessionConfigPopupComponent>;

  constructor(
    private readonly appRef: ApplicationRef,
    private readonly injector: EnvironmentInjector
  ) {}

  open(): Promise<SessionConfig | undefined> {
    if (this.current) return Promise.resolve(undefined);
    
    const compRef = createComponent(SessionConfigPopupComponent, {
      environmentInjector: this.injector,
    });
    this.current = compRef;
    this.appRef.attachView(compRef.hostView);
    document.body.appendChild(compRef.location.nativeElement);

    return new Promise((resolve) => {
      const cleanup = () => {
        this.appRef.detachView(compRef.hostView);
        compRef.destroy();
        this.current = undefined;
      };
      
      compRef.instance.closed.subscribe(() => {
        cleanup();
        resolve(undefined);
      });
      
      compRef.instance.confirmed.subscribe((config) => {
        cleanup();
        this.saveConfig(config);
        resolve(config);
      });
    });
  }

  private saveConfig(config: SessionConfig): void {
    // Preserva o usuario_id existente se não foi fornecido
    const existingConfig = this.getConfig();
    if (existingConfig?.usuario_id !== undefined && config.usuario_id === undefined) {
      config.usuario_id = existingConfig.usuario_id;
    }
    localStorage.setItem('session_config', JSON.stringify(config));
  }

  getConfig(): SessionConfig | null {
    const saved = localStorage.getItem('session_config');
    if (!saved) return null;
    
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('Erro ao ler configuração de sessão:', error);
      return null;
    }
  }

  clearConfig(): void {
    localStorage.removeItem('session_config');
  }
}

