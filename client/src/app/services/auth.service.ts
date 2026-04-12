import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userSignal());

  constructor(private http: HttpClient, private router: Router) {
    this.loadUser();
  }

  private async loadUser(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await firstValueFrom(this.http.get<{ user: User }>('/api/auth/me'));
      this.userSignal.set(res.user);
    } catch {
      localStorage.removeItem('token');
    }
  }

  async register(email: string, password: string, name: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ user: User; token: string }>('/api/auth/register', { email, password, name })
    );
    localStorage.setItem('token', res.token);
    this.userSignal.set(res.user);
    this.router.navigate(['/chat']);
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ user: User; token: string }>('/api/auth/login', { email, password })
    );
    localStorage.setItem('token', res.token);
    this.userSignal.set(res.user);
    this.router.navigate(['/chat']);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
}
