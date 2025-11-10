import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ExitFlowService {
  private resolver?: (value: boolean) => void;

  constructor(private readonly router: Router) {}

  open(): Promise<boolean> {
    this.router.navigateByUrl('/auth/exit');
    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  resolve(value: boolean): void {
    if (this.resolver) {
      this.resolver(value);
      this.resolver = undefined;
    }
  }
}


