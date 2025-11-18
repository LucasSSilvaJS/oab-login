import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Verifica se é um erro 401 (não autorizado)
        if (error.status === 401) {
          const errorDetail = error.error?.detail || '';
          
          // Verifica se o erro é relacionado a sessão não ativa
          if (
            errorDetail.includes('Sessão não ativa') ||
            errorDetail.includes('sessão não ativa') ||
            errorDetail.includes('Autenticação negada')
          ) {
            console.log('Sessão não está ativa no backend. Fazendo logout...');
            
            // Remove o token imediatamente
            localStorage.removeItem('oab_token');
            
            // Força logout e redireciona para login
            this.authService.forceLogoutOnSessionInactive();
          }
        }
        
        // Propaga o erro original
        return throwError(() => error);
      })
    );
  }
}

