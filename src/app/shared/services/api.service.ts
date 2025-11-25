import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginAdvogadoRequest {
  registro_oab: string;
  codigo_de_seguranca: string;
}

export interface LoginAdvogadoResponse {
  access_token: string;
  token_type: string;
  tipo_usuario: string;
  usuario_id: number;
  cadastro_id: number;
  nome: string;
}

export interface CadastroInfo {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  rg: string;
  endereco: string;
  cadastro_id: number;
  data_cadastro: string;
}

export interface UsuarioAdvogadoResponse {
  registro_oab: string;
  codigo_de_seguranca: string;
  adimplencia_oab: boolean;
  usuario_id: number;
  cadastro_id: number;
  cadastro?: CadastroInfo; // Opcional caso a API não retorne sempre
}

export interface SessaoCreate {
  data?: string; // YYYY-MM-DD, opcional (usa data atual se não fornecido)
  inicio_de_sessao?: string; // ISO datetime, opcional (usa agora se não fornecido)
  final_de_sessao?: string; // ISO datetime, opcional (30 minutos depois se não fornecido)
  ativado?: boolean; // padrão: true
  computador_id: number;
  usuario_id: number;
  administrador_id: number;
  analista_ids?: number[]; // opcional
}

export interface SessaoResponse {
  sessao_id: number;
  data: string;
  inicio_de_sessao: string;
  final_de_sessao: string | null;
  ativado: boolean;
  computador_id: number;
  usuario_id: number;
  administrador_id: number;
  analista_ids?: number[];
}

export interface SessaoUpdate {
  final_de_sessao?: string;
  ativado?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * Realiza login de advogado
   */
  loginAdvogado(credentials: LoginAdvogadoRequest): Observable<LoginAdvogadoResponse> {
    const url = `${this.baseUrl}/api/v1/auth/login/advogado`;
    return this.http.post<LoginAdvogadoResponse>(url, credentials).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Obtém informações completas do usuário advogado por ID
   */
  getUsuarioInfo(usuarioId: number, token: string): Observable<UsuarioAdvogadoResponse> {
    const url = `${this.baseUrl}/api/v1/usuarios-advogados/${usuarioId}`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.get<UsuarioAdvogadoResponse>(url, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Cria uma nova sessão
   */
  criarSessao(sessao: SessaoCreate, token: string): Observable<SessaoResponse> {
    const url = `${this.baseUrl}/api/v1/sessoes`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    
    console.log('📡 ApiService.criarSessao - URL:', url);
    console.log('📡 ApiService.criarSessao - Headers:', {
      Authorization: `Bearer ${token.substring(0, 20)}...`,
      'Content-Type': 'application/json'
    });
    console.log('📡 ApiService.criarSessao - Body:', sessao);
    
    console.log('═══════════════════════════════════════');
    console.log('📡 CRIANDO SESSÃO NA API');
    console.log('═══════════════════════════════════════');
    console.log('🌐 URL:', url);
    console.log('📦 Payload JSON:', JSON.stringify(sessao, null, 2));
    console.log('🔑 Token presente:', !!token);
    console.log('═══════════════════════════════════════');
    
    return this.http.post<SessaoResponse>(url, sessao, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('═══════════════════════════════════════');
        console.error('❌ ERRO AO CRIAR SESSÃO');
        console.error('═══════════════════════════════════════');
        console.error('❌ Status HTTP:', error.status);
        console.error('❌ Status Text:', error.statusText);
        console.error('❌ Error body:', JSON.stringify(error.error, null, 2));
        console.error('❌ Error message:', error.message);
        console.error('═══════════════════════════════════════');
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Atualiza uma sessão existente
   */
  atualizarSessao(sessaoId: number, sessao: SessaoUpdate, token: string): Observable<SessaoResponse> {
    const url = `${this.baseUrl}/api/v1/sessoes/${sessaoId}`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.put<SessaoResponse>(url, sessao, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Finaliza uma sessão ativa
   */
  finalizarSessao(sessaoId: number, token: string): Observable<SessaoResponse> {
    const url = `${this.baseUrl}/api/v1/sessoes/${sessaoId}/finalizar`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.post<SessaoResponse>(url, {}, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Obtém informações de uma sessão por ID
   */
  getSessao(sessaoId: number, token: string): Observable<SessaoResponse> {
    const url = `${this.baseUrl}/api/v1/sessoes/${sessaoId}`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.get<SessaoResponse>(url, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  private handleError(error: HttpErrorResponse): any {
    // Preserva o erro original com todas as informações
    const enhancedError: any = new Error();
    
    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      enhancedError.message = `Erro de conexão: ${error.error.message}`;
      enhancedError.type = 'client';
    } else {
      // Erro do lado do servidor
      enhancedError.message = error.error?.detail || error.message || 'Erro desconhecido';
      enhancedError.type = 'server';
      enhancedError.status = error.status;
      enhancedError.statusText = error.statusText;
      enhancedError.error = error.error; // Preserva o erro completo do servidor
    }
    
    // Preserva informações adicionais
    enhancedError.originalError = error;
    enhancedError.url = error.url;
    
    return enhancedError;
  }
}

