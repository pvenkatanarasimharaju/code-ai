import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ChatMessageComponent } from '../../components/chat-message/chat-message.component';
import { ChatInputComponent } from '../../components/chat-input/chat-input.component';

@Component({
  selector: 'app-chat',
  imports: [SidebarComponent, ChatMessageComponent, ChatInputComponent],
  styles: `
    :host { display: block; height: 100vh; }
    .chat-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-primary);
    }

    /* Mobile overlay */
    .mobile-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 20;
    }

    /* Sidebar */
    .sidebar-wrapper {
      width: 280px;
      flex-shrink: 0;
      z-index: 30;
      transition: transform 0.3s ease;
    }
    .sidebar-wrapper.desktop {
      position: relative;
    }
    .sidebar-wrapper.mobile-open {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      transform: translateX(0);
    }
    .sidebar-wrapper.mobile-closed {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      transform: translateX(-100%);
    }

    /* Main area */
    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--bg-primary);
    }

    /* Top bar */
    .topbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
    }
    .menu-btn {
      display: none;
      padding: 8px;
      border-radius: 10px;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s;
    }
    .menu-btn:hover { background: var(--bg-hover); }
    .topbar-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      flex-shrink: 0;
    }
    .topbar-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Messages scroll area */
    .messages-area {
      flex: 1;
      overflow-y: auto;
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 24px;
      animation: fadeInUp 0.5s ease-out;
    }
    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 24px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 32px;
      box-shadow: 0 0 40px var(--accent-glow);
    }
    .empty-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 10px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .empty-subtitle {
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.6;
      max-width: 440px;
      margin-bottom: 36px;
    }

    /* Prompt cards */
    .prompt-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      max-width: 520px;
      width: 100%;
    }
    .prompt-card {
      text-align: left;
      padding: 18px;
      border-radius: 16px;
      border: 1px solid var(--border-color);
      background: var(--bg-card);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
    }
    .prompt-card:hover {
      background: var(--bg-hover);
      border-color: var(--border-focus);
      transform: translateY(-1px);
    }
    .prompt-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    .prompt-label.explain { color: var(--accent); }
    .prompt-label.code { color: #e040fb; }
    .prompt-label.best { color: var(--success); }
    .prompt-label.debug { color: var(--error); }
    .prompt-text {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.4;
    }
    .prompt-card:hover .prompt-text { color: var(--text-primary); }

    /* Streaming indicator */
    .streaming-row {
      padding: 16px 20px;
    }
    .streaming-inner {
      max-width: 768px;
      margin: 0 auto;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .streaming-avatar {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .bounce-dots {
      display: flex;
      gap: 6px;
      padding-top: 10px;
    }
    .bounce-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      animation: bounce 1.2s ease-in-out infinite;
    }
    .bounce-dot:nth-child(2) { animation-delay: 0.15s; }
    .bounce-dot:nth-child(3) { animation-delay: 0.3s; }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-8px); }
    }

    @media (max-width: 768px) {
      .menu-btn { display: flex; }
      .sidebar-wrapper.desktop { display: none; }
      .prompt-grid { grid-template-columns: 1fr; }
    }
    @media (min-width: 769px) {
      .sidebar-wrapper.mobile-open,
      .sidebar-wrapper.mobile-closed { display: none; }
      .mobile-overlay { display: none !important; }
    }
  `,
  template: `
    <div class="chat-layout">
      @if (sidebarOpen()) {
        <div class="mobile-overlay" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Desktop sidebar -->
      <aside class="sidebar-wrapper desktop">
        <app-sidebar />
      </aside>
      <!-- Mobile sidebar -->
      <aside class="sidebar-wrapper" [class]="sidebarOpen() ? 'mobile-open' : 'mobile-closed'">
        <app-sidebar />
      </aside>

      <main class="chat-main">
        <div class="topbar">
          <button class="menu-btn" (click)="sidebarOpen.set(!sidebarOpen())">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="topbar-info">
            <div class="status-dot"></div>
            <h2 class="topbar-title">{{ chat.activeConversation()?.title || 'Code AI' }}</h2>
          </div>
        </div>

        <div #scrollContainer class="messages-area">
          @if (chat.messages().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h2 class="empty-title">How can I help you today?</h2>
              <p class="empty-subtitle">Start a conversation by typing below. I can help with coding, writing, analysis, and more.</p>
              <div class="prompt-grid">
                <button class="prompt-card" (click)="onSend('Explain how async/await works in JavaScript')">
                  <p class="prompt-label explain">Explain</p>
                  <p class="prompt-text">How async/await works in JS</p>
                </button>
                <button class="prompt-card" (click)="onSend('Write a Python function to reverse a linked list')">
                  <p class="prompt-label code">Write code</p>
                  <p class="prompt-text">Reverse a linked list in Python</p>
                </button>
                <button class="prompt-card" (click)="onSend('What are the best practices for REST API design?')">
                  <p class="prompt-label best">Best practices</p>
                  <p class="prompt-text">REST API design patterns</p>
                </button>
                <button class="prompt-card" (click)="onSend('Debug this error: TypeError: Cannot read properties of undefined')">
                  <p class="prompt-label debug">Debug</p>
                  <p class="prompt-text">TypeError: Cannot read properties</p>
                </button>
              </div>
            </div>
          } @else {
            @for (msg of chat.messages(); track msg.id) {
              <app-chat-message [message]="msg" />
            }
            @if (chat.isStreaming()) {
              <div class="streaming-row">
                <div class="streaming-inner">
                  <div class="streaming-avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div class="bounce-dots">
                    <div class="bounce-dot"></div>
                    <div class="bounce-dot"></div>
                    <div class="bounce-dot"></div>
                  </div>
                </div>
              </div>
            }
          }
        </div>

        <app-chat-input
          [disabled]="chat.isStreaming()"
          (sendMessage)="onSend($event)"
        />
      </main>
    </div>
  `,
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  chat = inject(ChatService);
  sidebarOpen = signal(false);
  private shouldScroll = false;

  async ngOnInit(): Promise<void> {
    await this.chat.loadConversations();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  async onSend(message: string): Promise<void> {
    this.shouldScroll = true;
    await this.chat.sendMessage(message);
    this.shouldScroll = true;
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
