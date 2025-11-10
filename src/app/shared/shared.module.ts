import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// Centraliza módulos compartilhados entre recursos
@NgModule({
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
  exports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
})
export class SharedModule {}


