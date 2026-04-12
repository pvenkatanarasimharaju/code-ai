import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ChatMessageComponent } from '../../components/chat-message/chat-message.component';
import { ChatInputComponent } from '../../components/chat-input/chat-input.component';

@Component({
  selector: 'app-chat',
  imports: [SidebarComponent, ChatMessageComponent, ChatInputComponent],
  template: `
    <div class="flex h-screen overflow-hidden">
      <!-- Mobile sidebar overlay -->
      @if (sidebarOpen()) {
        <div
          class="fixed inset-0 bg-black/50 z-20 md:hidden"
          (click)="sidebarOpen.set(false)"
        ></div>
      }

      <!-- Sidebar -->
      <aside
        class="w-64 shrink-0 border-r border-[var(--border-color)] z-30 transition-transform duration-200"
        [class]="sidebarOpen()
          ? 'fixed inset-y-0 left-0 translate-x-0 md:relative md:translate-x-0'
          : 'fixed inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0'"
      >
        <app-sidebar />
      </aside>

      <!-- Main chat area -->
      <main class="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]">
        <!-- Top bar -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <button
            class="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            (click)="sidebarOpen.set(!sidebarOpen())"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2 class="text-sm font-medium text-[var(--text-primary)] truncate">
            {{ chat.activeConversation()?.title || 'Code AI' }}
          </h2>
        </div>

        <!-- Messages -->
        <div #scrollContainer class="flex-1 overflow-y-auto">
          @if (chat.messages().length === 0) {
            <!-- Empty state -->
            <div class="flex flex-col items-center justify-center h-full text-center px-4">
              <div class="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h2 class="text-2xl font-semibold text-[var(--text-primary)] mb-2">How can I help you today?</h2>
              <p class="text-[var(--text-secondary)] max-w-md">
                Start a conversation by typing a message below. I can help with coding, writing, analysis, and more.
              </p>
            </div>
          } @else {
            @for (msg of chat.messages(); track msg.id) {
              <app-chat-message [message]="msg" />
            }
            @if (chat.isStreaming()) {
              <div class="py-2 px-4">
                <div class="max-w-3xl mx-auto flex gap-4">
                  <div class="w-8"></div>
                  <div class="flex gap-1 py-2">
                    <div class="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style="animation-delay: 300ms"></div>
                  </div>
                </div>
              </div>
            }
          }
        </div>

        <!-- Input -->
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
