import { Component, ChangeDetectionStrategy, ElementRef, EventEmitter, Output, Renderer2 } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-admin-password-popup',
  templateUrl: './admin-password-popup.component.html',
  styleUrls: ['./admin-password-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class AdminPasswordPopupComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<string>();

  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(3)]],
  });

  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(private readonly fb: FormBuilder, private readonly el: ElementRef<HTMLElement>, private readonly renderer: Renderer2) {}

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
    this.confirmed.emit(this.form.controls.password.value!);
  }
}


