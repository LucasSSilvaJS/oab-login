import { ApplicationRef, ComponentRef, Injectable, createComponent, EnvironmentInjector } from '@angular/core';
import { AdminPasswordPopupComponent } from '../components/admin-password-popup/admin-password-popup.component';

@Injectable({ providedIn: 'root' })
export class PasswordPopupService {
  private current?: ComponentRef<AdminPasswordPopupComponent>;

  constructor(private readonly appRef: ApplicationRef, private readonly injector: EnvironmentInjector) {}

  open(): Promise<string | undefined> {
    if (this.current) return Promise.resolve(undefined);
    const compRef = createComponent(AdminPasswordPopupComponent, { environmentInjector: this.injector });
    this.current = compRef;
    this.appRef.attachView(compRef.hostView);
    document.body.appendChild(compRef.location.nativeElement);

    return new Promise((resolve) => {
      const cleanup = () => {
        this.appRef.detachView(compRef.hostView);
        compRef.destroy();
        this.current = undefined;
      };
      compRef.instance.closed.subscribe(() => {
        cleanup();
        resolve(undefined);
      });
      compRef.instance.confirmed.subscribe((pwd) => {
        cleanup();
        resolve(pwd);
      });
    });
  }
}


