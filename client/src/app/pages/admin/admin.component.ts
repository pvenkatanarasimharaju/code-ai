import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AdminService, AdminUser } from '../../services/admin.service';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private admin = inject(AdminService);

  users = signal<AdminUser[]>([]);
  loading = signal(true);
  error = signal('');

  editingUser = signal<AdminUser | null>(null);
  editName = '';
  editEmail = '';
  editPassword = '';
  editError = signal('');
  editLoading = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.users.set(await this.admin.listUsers());
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(user: AdminUser): void {
    this.editingUser.set(user);
    this.editName = user.name;
    this.editEmail = user.email;
    this.editPassword = '';
    this.editError.set('');
  }

  cancelEdit(): void {
    this.editingUser.set(null);
  }

  async saveEdit(): Promise<void> {
    const u = this.editingUser();
    if (!u) return;

    const data: { name?: string; email?: string; password?: string } = {};
    if (this.editName.trim() && this.editName.trim() !== u.name) data.name = this.editName.trim();
    if (this.editEmail.trim() && this.editEmail.trim() !== u.email) data.email = this.editEmail.trim();
    if (this.editPassword.trim()) data.password = this.editPassword.trim();

    if (!data.name && !data.email && !data.password) {
      this.cancelEdit();
      return;
    }

    this.editLoading.set(true);
    this.editError.set('');
    try {
      await this.admin.updateUser(u.id, data);
      this.editingUser.set(null);
      await this.loadUsers();
    } catch (err: any) {
      this.editError.set(err?.error?.error || 'Update failed');
    } finally {
      this.editLoading.set(false);
    }
  }

  async deleteUser(user: AdminUser): Promise<void> {
    try {
      await this.admin.deleteUser(user.id);
      await this.loadUsers();
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Delete failed');
    }
  }
}
