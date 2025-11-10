import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginPage } from './pages/login/login.page';
import { AuthService } from './services/auth.service';

@NgModule({
  imports: [SharedModule, LoginPage, AuthRoutingModule],
  declarations: [],
  providers: [AuthService],
})
export class AuthModule {}


