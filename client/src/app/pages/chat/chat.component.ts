import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ChatMessageComponent } from '../../components/chat-message/chat-message.component';
import { ChatInputComponent } from '../../components/chat-input/chat-input.component';

@Component({
  selector: 'app-chat',
  imports: [SidebarComponent, ChatMessageComponent, ChatInputComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
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
