import { Component, output, input, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule],
  styles: `
    :host { display: block; }
    .input-wrapper {
      border-top: 1px solid var(--border-color);
      background: var(--bg-primary);
      padding: 16px 20px 12px;
    }
    .input-inner {
      max-width: 768px;
      margin: 0 auto;
    }
    .input-box {
      display: flex;
      align-items: flex-end;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .input-box:focus-within {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .input-textarea {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      padding: 14px 4px 14px 18px;
      resize: none;
      outline: none;
      max-height: 192px;
      font-size: 14px;
      line-height: 1.6;
      font-family: inherit;
    }
    .input-textarea::placeholder {
      color: var(--text-muted);
    }
    .send-btn {
      margin: 8px;
      padding: 10px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, box-shadow 0.2s, background 0.2s;
    }
    .send-btn.active {
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      color: white;
    }
    .send-btn.active:hover {
      opacity: 0.9;
      box-shadow: 0 2px 12px var(--accent-glow);
    }
    .send-btn.inactive {
      background: var(--bg-hover);
      color: var(--text-muted);
      cursor: not-allowed;
    }
    .disclaimer {
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
      margin-top: 10px;
      opacity: 0.5;
    }
  `,
  template: `
    <div class="input-wrapper">
      <div class="input-inner">
        <div class="input-box">
          <textarea
            #textareaRef
            [(ngModel)]="text"
            (keydown)="onKeydown($event)"
            (input)="autoResize()"
            [disabled]="disabled()"
            rows="1"
            placeholder="Message Code AI..."
            class="input-textarea"
          ></textarea>
          <button
            (click)="send()"
            [disabled]="!text.trim() || disabled()"
            class="send-btn"
            [class]="text.trim() && !disabled() ? 'active' : 'inactive'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <p class="disclaimer">Code AI can make mistakes. Verify important information.</p>
      </div>
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
