import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

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

  readonly remainingSeconds$ = this.remainingSecondsSubject.asObservable();
  readonly active$ = this.activeSubject.asObservable();
  readonly info$ = this.infoSubject.asObservable();

  constructor(private readonly zone: NgZone) {}

  start(info: SessionInfo): void {
    this.stop();
    this.infoSubject.next(info);
    this.remainingSecondsSubject.next(info.totalSeconds);
    this.activeSubject.next(true);
    // Usa NgZone para manter o contador preciso sem atrapalhar a UI
    this.zone.runOutsideAngular(() => {
      this.tickSub = interval(1000).subscribe(() => {
        const next = this.remainingSecondsSubject.value - 1;
        if (next <= 0) {
          this.zone.run(() => this.stop());
        } else {
          this.remainingSecondsSubject.next(next);
        }
      });
    });
  }

  stop(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = undefined;
    this.remainingSecondsSubject.next(0);
    this.activeSubject.next(false);
    this.infoSubject.next(null);
  }

  get isActive(): boolean {
    return this.activeSubject.value;
  }

  get remainingSeconds(): number {
    return this.remainingSecondsSubject.value;
  }
}


