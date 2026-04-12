import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  styles: `
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      position: relative;
      overflow: hidden;
      padding: 24px;
    }
    .bg-orb-1 {
      position: absolute;
      top: -20%;
      right: -10%;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: #e040fb;
      opacity: 0.04;
      filter: blur(120px);
      pointer-events: none;
    }
    .bg-orb-2 {
      position: absolute;
      bottom: -20%;
      left: -10%;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: var(--accent);
      opacity: 0.04;
      filter: blur(120px);
      pointer-events: none;
    }
    .auth-wrapper {
      width: 100%;
      max-width: 440px;
      position: relative;
      z-index: 1;
      animation: fadeInUp 0.5s ease-out;
    }
    .logo-area {
      text-align: center;
      margin-bottom: 36px;
    }
    .logo-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      margin-bottom: 20px;
      box-shadow: 0 0 30px var(--accent-glow);
    }
    .logo-title {
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 6px;
    }
    .logo-subtitle {
      color: var(--text-muted);
      font-size: 14px;
    }
    .auth-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(108, 99, 255, 0.06);
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      margin-bottom: 24px;
      border-radius: 12px;
      font-size: 13px;
      background: var(--error-bg);
      border: 1px solid rgba(255, 107, 107, 0.2);
      color: var(--error);
    }
    .form-group {
      margin-bottom: 22px;
    }
    .form-group:last-of-type {
      margin-bottom: 28px;
    }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .form-input {
      width: 100%;
      padding: 14px 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    .form-input::placeholder {
      color: var(--text-muted);
    }
    .form-input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .submit-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      color: white;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: opacity 0.2s, box-shadow 0.2s;
    }
    .submit-btn:hover:not(:disabled) {
      opacity: 0.9;
      box-shadow: 0 4px 24px var(--accent-glow);
    }
    .submit-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .footer-divider {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      text-align: center;
    }
    .footer-text {
      font-size: 14px;
      color: var(--text-muted);
    }
    .footer-link {
      color: var(--accent);
      font-weight: 500;
      margin-left: 4px;
      text-decoration: none;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: var(--accent-hover);
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `,
  template: `
    <div class="auth-page">
      <div class="bg-orb-1"></div>
      <div class="bg-orb-2"></div>

      <div class="auth-wrapper">
        <div class="logo-area">
          <div class="logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </div>
          <h1 class="logo-title">Join Code AI</h1>
          <p class="logo-subtitle">Create your free account</p>
        </div>

        <div class="auth-card">
          @if (error()) {
            <div class="error-banner">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span>{{ error() }}</span>
            </div>
          }

          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                class="form-input"
                placeholder="Your name"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                class="form-input"
                placeholder="you&#64;example.com"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                class="form-input"
                placeholder="Min 6 characters"
              />
            </div>

            <button type="submit" [disabled]="loading()" class="submit-btn">
              {{ loading() ? 'Creating account...' : 'Create Account' }}
            </button>
          </form>

          <div class="footer-divider">
            <p class="footer-text">
              Already have an account?
              <a routerLink="/login" class="footer-link">Sign in</a>
            </p>
          </div>
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
