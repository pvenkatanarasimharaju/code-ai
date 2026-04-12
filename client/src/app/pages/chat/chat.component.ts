import {
  Component,
  OnInit,
  signal,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
} from '@angular/core';
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
export class ChatComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  chat = inject(ChatService);
  sidebarOpen = signal(false);
  showJumpToLatest = signal(false);

  private shouldScroll = false;
  private scrollAfterConvSwitch = false;
  private lastConvIdForScroll: string | undefined = undefined;

  constructor() {
    effect(() => {
      const id = this.chat.activeConversation()?.id;
      if (id !== this.lastConvIdForScroll) {
        this.lastConvIdForScroll = id;
        if (id) {
          this.scrollAfterConvSwitch = true;
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.chat.resetSession();
    await Promise.all([
      this.chat.loadConversations(),
      this.chat.loadProviders(),
    ]);
  }

  ngAfterViewInit(): void {
    const el = this.scrollContainer?.nativeElement;
    el?.addEventListener('scroll', this.onScrollBound, { passive: true });
  }

  ngOnDestroy(): void {
    this.scrollContainer?.nativeElement?.removeEventListener('scroll', this.onScrollBound);
  }

  private readonly onScrollBound = (): void => {
    this.updateJumpButtonVisibility();
  };

  ngAfterViewChecked(): void {
    if (this.scrollAfterConvSwitch) {
      this.scrollToBottom();
      this.scrollAfterConvSwitch = false;
      this.updateJumpButtonVisibility();
    }
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
      this.updateJumpButtonVisibility();
    }
  }

  onMessagesScroll(): void {
    this.updateJumpButtonVisibility();
  }

  private updateJumpButtonVisibility(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el || this.chat.messages().length === 0) {
      this.showJumpToLatest.set(false);
      return;
    }
    const threshold = 120;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.showJumpToLatest.set(distanceFromBottom > threshold);
  }

  jumpToLatest(): void {
    this.scrollToBottom();
    this.showJumpToLatest.set(false);
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
