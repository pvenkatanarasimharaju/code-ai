import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { conversations: number };
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  async listUsers(): Promise<AdminUser[]> {
    const res = await firstValueFrom(
      this.http.get<{ users: AdminUser[] }>('/api/admin/users'),
    );
    return res.users;
  }

  async updateUser(
    id: string,
    data: { name?: string; email?: string; password?: string },
  ): Promise<void> {
    await firstValueFrom(this.http.patch(`/api/admin/users/${id}`, data));
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/admin/users/${id}`));
  }
}
