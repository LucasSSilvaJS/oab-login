import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notificationPermission: NotificationPermission = 'default';

  constructor(
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController
  ) {
    this.requestPermission();
  }

  private async requestPermission(): Promise<void> {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        this.notificationPermission = await Notification.requestPermission();
      } else {
        this.notificationPermission = Notification.permission;
      }
    }
  }

  /**
   * Exibe uma notificação nativa do Windows
   */
  async showNativeNotification(title: string, body: string, options?: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Notificações não são suportadas neste navegador');
      return;
    }

    if (this.notificationPermission !== 'granted') {
      this.notificationPermission = await Notification.requestPermission();
    }

    if (this.notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/assets/oab-logo.png',
        badge: '/assets/oab-logo.png',
        tag: 'session-expiry',
        requireInteraction: false,
        ...options,
      });

      // Fecha automaticamente após 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

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


