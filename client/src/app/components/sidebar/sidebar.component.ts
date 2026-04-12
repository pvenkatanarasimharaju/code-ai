import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, Conversation } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
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
    await this.chat.deleteConversation(id);
  }
}
