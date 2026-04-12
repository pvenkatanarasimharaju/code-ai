import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, Conversation } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [FormsModule],
  styles: `
    :host { display: block; height: 100%; }
    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
    }

    /* Header */
    .sidebar-header {
      padding: 20px 16px 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 4px;
      margin-bottom: 16px;
    }
    .brand-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-name {
      font-weight: 700;
      font-size: 15px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .new-chat-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      color: white;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s, box-shadow 0.2s;
    }
    .new-chat-btn:hover {
      opacity: 0.9;
      box-shadow: 0 2px 16px var(--accent-glow);
    }

    /* Conversation list */
    .conv-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 12px 12px;
    }
    .conv-section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      padding: 12px 8px 8px;
    }
    .conv-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-secondary);
      transition: background 0.15s, color 0.15s;
      border: 1px solid transparent;
      margin-bottom: 2px;
    }
    .conv-item:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .conv-item.active {
      background: var(--accent-soft);
      color: var(--text-primary);
      border-color: var(--border-color);
    }
    .conv-icon {
      flex-shrink: 0;
      opacity: 0.4;
    }
    .conv-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .conv-actions {
      display: none;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    .conv-item:hover .conv-actions {
      display: flex;
    }
    .conv-action-btn {
      padding: 4px;
      border-radius: 6px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .conv-action-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .conv-action-btn.delete:hover {
      background: var(--error-bg);
      color: var(--error);
    }
    .rename-input {
      flex: 1;
      background: var(--bg-secondary);
      border: 1px solid var(--border-focus);
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 13px;
      color: var(--text-primary);
      font-family: inherit;
      outline: none;
    }
    .empty-state {
      padding: 40px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
    }
    .empty-icon {
      margin: 0 auto 12px;
      opacity: 0.25;
    }

    /* User panel */
    .user-panel {
      padding: 12px;
      border-top: 1px solid var(--border-color);
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      transition: background 0.15s;
    }
    .user-row:hover {
      background: var(--bg-hover);
    }
    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--accent-soft);
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .user-avatar span {
      font-size: 13px;
      font-weight: 700;
      color: var(--accent);
    }
    .user-name {
      flex: 1;
      font-size: 13px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .logout-btn {
      padding: 6px;
      border-radius: 8px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: background 0.15s, color 0.15s;
    }
    .logout-btn:hover {
      background: var(--error-bg);
      color: var(--error);
    }
  `,
  template: `
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="brand">
          <div class="brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span class="brand-name">Code AI</span>
        </div>
        <button class="new-chat-btn" (click)="onNewChat()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Chat
        </button>
      </div>

      <div class="conv-list">
        <p class="conv-section-title">Conversations</p>
        @for (conv of chat.conversations(); track conv.id) {
          <div
            class="conv-item"
            [class.active]="conv.id === chat.activeConversation()?.id"
            (click)="onSelectConversation(conv.id)"
          >
            @if (editingId() === conv.id) {
              <input
                class="rename-input"
                [(ngModel)]="editTitle"
                (keydown.enter)="saveRename(conv.id)"
                (keydown.escape)="cancelRename()"
                (blur)="saveRename(conv.id)"
              />
            } @else {
              <svg class="conv-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="conv-title">{{ conv.title }}</span>
              <div class="conv-actions">
                <button class="conv-action-btn" (click)="startRename(conv, $event)" title="Rename">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="conv-action-btn delete" (click)="onDelete(conv.id, $event)" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            }
          </div>
        }

        @if (chat.conversations().length === 0) {
          <div class="empty-state">
            <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            No conversations yet
          </div>
        }
      </div>

      <div class="user-panel">
        <div class="user-row">
          <div class="user-avatar">
            <span>{{ (auth.user()?.name || '?')[0].toUpperCase() }}</span>
          </div>
          <span class="user-name">{{ auth.user()?.name }}</span>
          <button class="logout-btn" (click)="auth.logout()" title="Logout">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SidebarComponent {
  chat = inject(ChatService);
  auth = inject(AuthService);
  editingId = signal<string | null>(null);
  editTitle = '';

  async onNewChat(): Promise<void> {
    await this.chat.createConversation();
  }

  async onSelectConversation(id: string): Promise<void> {
    if (this.editingId()) return;
    await this.chat.selectConversation(id);
  }

  startRename(conv: Conversation, event: Event): void {
    event.stopPropagation();
    this.editingId.set(conv.id);
    this.editTitle = conv.title;
  }

  async saveRename(id: string): Promise<void> {
    if (this.editTitle.trim()) {
      await this.chat.renameConversation(id, this.editTitle.trim());
    }
    this.editingId.set(null);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  async onDelete(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await this.chat.deleteConversation(id);
    }
  }
}
