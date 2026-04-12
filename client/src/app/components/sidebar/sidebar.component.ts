import { Component, signal, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChatService, Conversation } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [FormsModule, RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  /** Fires after the user picks a thread or starts a new chat — parent can close the mobile drawer. */
  navigated = output<void>();

  chat = inject(ChatService);
  auth = inject(AuthService);
  editingId = signal<string | null>(null);
  editTitle = '';

  async onNewChat(): Promise<void> {
    await this.chat.createConversation();
    this.navigated.emit();
  }

  async onSelectConversation(id: string): Promise<void> {
    if (this.editingId()) return;
    await this.chat.selectConversation(id);
    this.navigated.emit();
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
    await this.chat.deleteConversation(id);
  }
}
