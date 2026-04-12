import { Component, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, Conversation } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [FormsModule],
  template: `
    <div class="flex flex-col h-full bg-[var(--bg-secondary)]">
      <!-- Header -->
      <div class="p-3 border-b border-[var(--border-color)]">
        <button
          (click)="onNewChat()"
          class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-primary)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Chat
        </button>
      </div>

      <!-- Conversation List -->
      <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
        @for (conv of chat.conversations(); track conv.id) {
          <div
            class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition"
            [class]="conv.id === chat.activeConversation()?.id
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
            (click)="onSelectConversation(conv.id)"
          >
            @if (editingId() === conv.id) {
              <input
                class="flex-1 bg-transparent border border-[var(--accent)] rounded px-1 py-0.5 text-sm text-[var(--text-primary)] focus:outline-none"
                [(ngModel)]="editTitle"
                (keydown.enter)="saveRename(conv.id)"
                (keydown.escape)="cancelRename()"
                (blur)="saveRename(conv.id)"
              />
            } @else {
              <span class="flex-1 truncate">{{ conv.title }}</span>
              <div class="hidden group-hover:flex items-center gap-1">
                <button
                  (click)="startRename(conv, $event)"
                  class="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  title="Rename"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  (click)="onDelete(conv.id, $event)"
                  class="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-red-400"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            }
          </div>
        }

        @if (chat.conversations().length === 0) {
          <div class="px-3 py-8 text-center text-[var(--text-muted)] text-sm">
            No conversations yet
          </div>
        }
      </div>

      <!-- User / Logout -->
      <div class="p-3 border-t border-[var(--border-color)]">
        <div class="flex items-center justify-between px-3 py-2">
          <span class="text-sm text-[var(--text-secondary)] truncate">{{ auth.user()?.name }}</span>
          <button
            (click)="auth.logout()"
            class="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
