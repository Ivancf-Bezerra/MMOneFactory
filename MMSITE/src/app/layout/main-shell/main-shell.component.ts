import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideBell } from '@lucide/angular';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { ClerkService } from '../../core/services/clerk.service';
import { AppNotification } from '../../core/models/app-notification.model';

@Component({
  selector: 'app-main-shell',
  imports: [
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LucideBell,
  ],
  templateUrl: './main-shell.component.html',
})
export class MainShellComponent {
  avatarMenuOpen = false;
  notificationsPanelOpen = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);

  readonly notifications$ = this.notificationService.notifications$;
  readonly unreadCount$ = this.notificationService.unreadCount$;

  constructor(
    private readonly authService: AuthService,
    private readonly clerkService: ClerkService,
    private readonly router: Router,
  ) {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.notificationService.refreshCurrentUser());
  }

  async logout(): Promise<void> {
    this.avatarMenuOpen = false;
    this.notificationsPanelOpen = false;
    try {
      await this.clerkService.signOut();
    } catch {
      // Mantém logout local mesmo se sessão social não estiver ativa.
    }
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  toggleAvatarMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.avatarMenuOpen = !this.avatarMenuOpen;
    if (this.avatarMenuOpen) {
      this.notificationsPanelOpen = false;
    }
  }

  closeAvatarMenu(): void {
    this.avatarMenuOpen = false;
  }

  toggleNotificationsPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationsPanelOpen = !this.notificationsPanelOpen;
    if (this.notificationsPanelOpen) {
      this.notificationService.refreshCurrentUser();
      this.avatarMenuOpen = false;
    }
  }

  closeNotificationsPanel(): void {
    this.notificationsPanelOpen = false;
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  openNotification(n: AppNotification, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.notificationService.markRead(n.id);
    if (n.href) {
      void this.router.navigateByUrl(n.href);
    }
    this.notificationsPanelOpen = false;
  }

  editProfile(): void {
    this.avatarMenuOpen = false;
    void this.router.navigate(['/profile']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAvatarMenu();
    this.closeNotificationsPanel();
  }

  userDisplayName(): string {
    return this.authService.userDisplayName() ?? 'Usuário';
  }

  userAvatarInitials(): string {
    const name = this.userDisplayName().trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0]!.slice(0, 2).toUpperCase();
    }
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  }
}
