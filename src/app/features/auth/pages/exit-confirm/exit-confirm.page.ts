import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../shared/shared.module';
import { ExitFlowService } from '../../../../shared/services/exit-flow.service';

@Component({
  selector: 'app-exit-confirm',
  templateUrl: './exit-confirm.page.html',
  styleUrls: ['./exit-confirm.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class ExitConfirmPage {
  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(3)]],
  });

  isChecking = false;
  error?: string;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly exitFlow: ExitFlowService
  ) {}

  async confirm(): Promise<void> {
    if (this.form.invalid || this.isChecking) {
      this.form.markAllAsTouched();
      return;
    }
    this.isChecking = true;
    this.error = undefined;
    const password = this.form.controls.password.value!;
    try {
      const ok: boolean = await (window as any).electronAPI?.verifyAdminPassword?.(password);
      if (ok) {
        this.exitFlow.resolve(true);
        (window as any).electronAPI?.exitApp?.();
      } else {
        this.error = 'Senha inválida.';
      }
    } finally {
      this.isChecking = false;
    }
  }

  back(): void {
    this.exitFlow.resolve(false);
    this.router.navigateByUrl('/auth/login');
  }
}


