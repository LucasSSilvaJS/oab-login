import { Component, ChangeDetectionStrategy, ElementRef, EventEmitter, Output, Renderer2 } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';

export interface SessionConfig {
  computador_id: number;
  administrador_id: number;
  usuario_id?: number; // Será preenchido automaticamente após login
}

@Component({
  selector: 'app-session-config-popup',
  templateUrl: './session-config-popup.component.html',
  styleUrls: ['./session-config-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class SessionConfigPopupComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<SessionConfig>();

  readonly form = this.fb.group({
    computador_id: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    administrador_id: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2
  ) {
    // Carrega valores salvos se existirem
    this.loadSavedValues();
  }

  private loadSavedValues(): void {
    const savedConfig = localStorage.getItem('session_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        this.form.patchValue({
          computador_id: config.computador_id?.toString() || '',
          administrador_id: config.administrador_id?.toString() || '',
        });
      } catch (error) {
        console.warn('Erro ao carregar configuração salva:', error);
      }
    }
  }

  startDrag(event: MouseEvent): void {
    this.isDragging = true;
    const rect = this.el.nativeElement.querySelector('.popup')!.getBoundingClientRect();
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    this.renderer.addClass(document.body, 'dragging');
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    const popup = this.el.nativeElement.querySelector('.popup') as HTMLElement;
    const x = event.clientX - this.dragOffsetX;
    const y = event.clientY - this.dragOffsetY;
    popup.style.left = Math.max(12, x) + 'px';
    popup.style.top = Math.max(12, y) + 'px';
  }

  stopDrag(): void {
    this.isDragging = false;
    this.renderer.removeClass(document.body, 'dragging');
  }

  cancel(): void {
    this.closed.emit();
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Preserva o usuario_id existente se houver
    const savedConfig = localStorage.getItem('session_config');
    let existingUsuarioId: number | undefined;
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        existingUsuarioId = config.usuario_id;
      } catch (error) {
        // Ignora erro
      }
    }

    const config: SessionConfig = {
      computador_id: parseInt(this.form.controls.computador_id.value!, 10),
      administrador_id: parseInt(this.form.controls.administrador_id.value!, 10),
    };

    // Mantém o usuario_id se existir
    if (existingUsuarioId !== undefined) {
      config.usuario_id = existingUsuarioId;
    }

    this.confirmed.emit(config);
  }
}

