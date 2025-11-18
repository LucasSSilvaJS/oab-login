import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, interval, Subscription, Subject } from 'rxjs';
import { NotificationService } from './notification.service';

export interface SessionInfo {
  userName: string;
  oabNumber: string;
  totalSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class SessionTimerService {
  private tickSub?: Subscription;
  private remainingSecondsSubject = new BehaviorSubject<number>(0);
  private activeSubject = new BehaviorSubject<boolean>(false);
  private infoSubject = new BehaviorSubject<SessionInfo | null>(null);
  private notifiedMinutes: Set<number> = new Set();

  readonly remainingSeconds$ = this.remainingSecondsSubject.asObservable();
  readonly active$ = this.activeSubject.asObservable();
  readonly info$ = this.infoSubject.asObservable();
  readonly sessionExpired$ = new Subject<void>(); // Emite quando a sessão expira

  constructor(
    private readonly zone: NgZone,
    private readonly notificationService: NotificationService
  ) {}

  start(info: SessionInfo): void {
    this.stop();
    this.notifiedMinutes.clear();
    this.infoSubject.next(info);
    this.remainingSecondsSubject.next(info.totalSeconds);
    this.activeSubject.next(true);
    // Usa NgZone para manter o contador preciso sem atrapalhar a UI
    this.zone.runOutsideAngular(() => {
      this.tickSub = interval(1000).subscribe(() => {
        const next = this.remainingSecondsSubject.value - 1;
        if (next <= 0) {
          this.zone.run(() => {
            this.sessionExpired$.next(); // Emite evento de expiração
            this.stop();
          });
        } else {
          this.remainingSecondsSubject.next(next);
          this.checkAndNotify(next);
        }
      });
    });
  }

  private checkAndNotify(remainingSeconds: number): void {
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    
    // Notifica quando faltam 5, 3 ou 1 minuto
    if (remainingMinutes === 5 && !this.notifiedMinutes.has(5)) {
      this.notifiedMinutes.add(5);
      this.zone.run(() => {
        this.notificationService.showNativeNotification(
          'Sessão Expirando',
          'Falta um pouco mais que 5 minutos para encerrar a sessão.',
          { tag: 'session-5min' }
        );
      });
    } else if (remainingMinutes === 3 && !this.notifiedMinutes.has(3)) {
      this.notifiedMinutes.add(3);
      this.zone.run(() => {
        this.notificationService.showNativeNotification(
          'Sessão Expirando',
          'Falta um pouco mais que 3 minutos para encerrar a sessão.',
          { tag: 'session-3min' }
        );
      });
    } else if (remainingMinutes === 1 && !this.notifiedMinutes.has(1)) {
      this.notifiedMinutes.add(1);
      this.zone.run(() => {
        this.notificationService.showNativeNotification(
          'Sessão Expirando',
          'Falta um pouco mais que 1 minuto para encerrar a sessão!',
          { tag: 'session-1min', requireInteraction: true }
        );
      });
    }
  }

  stop(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = undefined;
    this.remainingSecondsSubject.next(0);
    this.activeSubject.next(false);
    this.infoSubject.next(null);
    this.notifiedMinutes.clear();
  }

  get isActive(): boolean {
    return this.activeSubject.value;
  }

  get remainingSeconds(): number {
    return this.remainingSecondsSubject.value;
  }
}


