import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-shell.component.html',
})
export class MainShellComponent {
  constructor(private readonly authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}
