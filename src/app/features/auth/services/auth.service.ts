import { Injectable } from '@angular/core';

// Serviço simples para demonstrar autenticação; em produção integre API/OAuth.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'oab_token';

  async login(oabNumber: string, securityCode: string): Promise<boolean> {
    // Simula chamada à API com delay
    await new Promise((r) => setTimeout(r, 600));
    const isValid = Boolean(oabNumber) && Boolean(securityCode);
    if (isValid) {
      localStorage.setItem(this.tokenKey, 'mock-token');
    }
    return isValid;
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}


