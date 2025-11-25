import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  canActivate(): boolean | UrlTree {
    const isAuthenticated = this.auth.isAuthenticated();
    console.log('🔐 AuthGuard: Verificando autenticação...', { isAuthenticated });
    if (!isAuthenticated) {
      console.log('❌ AuthGuard: Usuário não autenticado. Redirecionando para login.');
      // Com hash routing, o Angular Router deve lidar automaticamente
      return this.router.parseUrl('/auth/login');
    }
    console.log('✅ AuthGuard: Usuário autenticado. Permitindo acesso.');
    return true;
  }
}


