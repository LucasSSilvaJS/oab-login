import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SessionTimerService } from '../../../shared/services/session-timer.service';

// Serviço simples para demonstrar autenticação; em produção integre API/OAuth.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'oab_token';

  constructor(
    private readonly sessionTimer: SessionTimerService,
    private readonly router: Router
  ) {}

  async login(oabNumber: string, securityCode: string): Promise<boolean> {
    // Simula chamada à API com delay
    await new Promise((r) => setTimeout(r, 600));
    // Validação mockada conforme solicitação: OAB 123 e código 123
    const isValid = oabNumber === '123' && securityCode === '123';
    if (isValid) {
      localStorage.setItem(this.tokenKey, 'mock-token');
      // Inicia sessão com 30 minutos e dados fake
      this.sessionTimer.start({
        userName: 'Gustavo',
        oabNumber: '123',
        totalSeconds: 30 * 60,
      });
    }
    return isValid;
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.sessionTimer.stop();
    // Garante retorno à tela inicial de login
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}


