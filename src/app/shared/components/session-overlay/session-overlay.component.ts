import { AfterViewInit, Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { map, Subscription, filter } from 'rxjs';
import { SessionTimerService } from '../../services/session-timer.service';
import { AuthService } from '../../../features/auth/services/auth.service';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-session-overlay',
  templateUrl: './session-overlay.component.html',
  styleUrls: ['./session-overlay.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class SessionOverlayComponent implements OnDestroy, AfterViewInit {
  isDragging = false;
  dragOffsetX = 0;
  dragOffsetY = 0;
  posX = 16;
  posY = 16;

  vm$ = this.session.info$.pipe(
    map((info) => ({
      active: this.session.isActive && !!info,
      name: info?.userName ?? '',
      oab: info?.oabNumber ?? '',
      remaining: this.formatTime(this.session.remainingSeconds),
    }))
  );

  private sub?: Subscription;
  private lastActive = false;
  hideOnHome = false;

  constructor(
    public readonly session: SessionTimerService,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {
    this.sub = new Subscription();
    // dispara recomputação do vm$
    this.sub.add(this.session.remainingSeconds$.subscribe(() => {}));
    // Auto-encerrar quando o contador zerar
    this.sub.add(this.session.active$.subscribe((active) => {
      if (this.lastActive && !active) {
        this.endSession();
      }
      this.lastActive = active;
    }));
    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((event) => {
          this.hideOnHome =
            (event.urlAfterRedirects ?? event.url ?? '').startsWith('/home');
        })
    );
    // estado inicial
    this.hideOnHome = this.router.url.startsWith('/home');
  }

  ngAfterViewInit(): void {
    // posiciona próximo ao canto superior direito ao iniciar
    const width = window.innerWidth || 1280;
    this.posX = Math.max(16, width - 320);
    this.posY = 24;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  beginDrag(event: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    const point = this.getPoint(event);
    this.dragOffsetX = point.clientX - this.posX;
    this.dragOffsetY = point.clientY - this.posY;
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  @HostListener('window:touchmove', ['$event'])
  onMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const point = this.getPoint(event);
    this.posX = Math.max(0, point.clientX - this.dragOffsetX);
    this.posY = Math.max(0, point.clientY - this.dragOffsetY);
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  endDrag(): void {
    this.isDragging = false;
  }

  async endSession(): Promise<void> {
    await this.auth.logout();
    (window as any).electronAPI?.endSession?.();
  }

  private getPoint(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if (event instanceof MouseEvent) return { clientX: event.clientX, clientY: event.clientY };
    const t = event.touches[0] ?? event.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }

  private formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  hideWindow(): void {
    // Apenas esconde a janela atual; o main process converte close em hide.
    window.close();
  }
}


