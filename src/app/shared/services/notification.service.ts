import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController
  ) {}

  async success(message: string): Promise<void> {
    await this.presentToast(message, 'success');
  }
  async error(message: string): Promise<void> {
    await this.presentToast(message, 'danger');
  }
  async info(message: string): Promise<void> {
    await this.presentToast(message, 'primary');
  }

  async alert(title: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: title,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'primary'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'top',
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }
}


