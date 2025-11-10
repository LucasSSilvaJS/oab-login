import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SessionOverlayComponent } from './components/session-overlay/session-overlay.component';

// Centraliza módulos compartilhados entre recursos
@NgModule({
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, SessionOverlayComponent],
  exports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, SessionOverlayComponent],
})
export class SharedModule {}


