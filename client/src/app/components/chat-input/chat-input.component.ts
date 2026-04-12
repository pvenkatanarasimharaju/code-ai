import { Component, output, input, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 pb-4">
      <div class="relative flex items-end bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-color)] focus-within:border-[var(--accent)] transition">
        <textarea
          #textareaRef
          [(ngModel)]="text"
          (keydown)="onKeydown($event)"
          (input)="autoResize()"
          [disabled]="disabled()"
          rows="1"
          placeholder="Message Code AI..."
          class="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] py-3.5 px-4 resize-none focus:outline-none max-h-48 text-sm leading-relaxed"
        ></textarea>
        <button
          (click)="send()"
          [disabled]="!text.trim() || disabled()"
          class="m-2 p-2 rounded-lg transition"
          [class]="text.trim() && !disabled()
            ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
            : 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <p class="text-xs text-[var(--text-muted)] text-center mt-2">
        Code AI can make mistakes. Check important info.
      </p>
    </div>
  `,
})
export class ChatInputComponent {
  @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;
  sendMessage = output<string>();
  disabled = input(false);
  text = '';

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const msg = this.text.trim();
    if (!msg) return;
    this.sendMessage.emit(msg);
    this.text = '';
    setTimeout(() => this.autoResize());
  }

  autoResize(): void {
    const el = this.textareaRef?.nativeElement;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 192) + 'px';
    }
  }
}
