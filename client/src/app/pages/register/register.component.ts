import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
      <div class="w-full max-w-md p-8">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Code AI</h1>
          <p class="text-[var(--text-secondary)]">Create your account</p>
        </div>

        <div class="bg-[var(--bg-primary)] rounded-xl p-8 shadow-lg border border-[var(--border-color)]">
          @if (error()) {
            <div class="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {{ error() }}
            </div>
          }

          <form (ngSubmit)="onSubmit()" class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
              <input
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
                placeholder="Your name"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              [disabled]="loading()"
              class="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading() ? 'Creating account...' : 'Create Account' }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-[var(--text-secondary)]">
            Already have an account?
            <a routerLink="/login" class="text-[var(--accent)] hover:underline ml-1">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  constructor(private auth: AuthService) {}

  async onSubmit(): Promise<void> {
    if (!this.name || !this.email || !this.password) {
      this.error.set('Please fill in all fields');
      return;
    }
    if (this.password.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.register(this.email, this.password, this.name);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Registration failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
