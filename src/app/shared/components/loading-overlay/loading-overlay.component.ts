import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-loading-overlay',
  templateUrl: './loading-overlay.component.html',
  styleUrls: ['./loading-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class LoadingOverlayComponent {
  @Input() message: string = 'Processando...';
  @Input() show: boolean = false;
}

