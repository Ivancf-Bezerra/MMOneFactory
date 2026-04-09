import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastCenterComponent } from './shared/components/toast-center/toast-center.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastCenterComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {}
