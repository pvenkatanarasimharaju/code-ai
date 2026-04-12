import { Component, input, OnInit, OnChanges, signal, computed } from '@angular/core';
import { Message } from '../../services/chat.service';
import { marked } from 'marked';
import hljs from 'highlight.js';

function isProviderErrorText(content: string): boolean {
  return (
    /GoogleGenerativeAI|Failed to parse stream|429|quota|rate.?limit/i.test(content) &&
    content.length < 2000
  );
}

@Component({
  selector: 'app-chat-message',
  styles: `
    :host { display: block; }
    .message-row {
      padding: 24px 20px;
      animation: fadeIn 0.3s ease-out;
    }
    .message-row.assistant {
      background: rgba(22, 22, 42, 0.35);
    }
    .message-inner {
      max-width: 768px;
      margin: 0 auto;
      display: flex;
      gap: 16px;
    }

    /* Avatar */
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .avatar.user {
      background: var(--user-bubble);
      border: 1px solid var(--border-color);
    }
    .avatar.ai {
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    }

    /* Content */
    .content {
      flex: 1;
      min-width: 0;
    }
    .role-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .role-label.user { color: var(--text-muted); }
    .role-label.ai { color: var(--accent); }
    .user-text {
      color: var(--text-primary);
      white-space: pre-wrap;
      line-height: 1.7;
      font-size: 15px;
    }
    .ai-text {
      color: var(--text-primary);
      font-size: 15px;
      line-height: 1.7;
    }
    .ai-error {
      color: #ff9b9b;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .typing {
      display: flex;
      gap: 6px;
      padding: 4px 0 8px;
    }
    .typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      animation: bounce 1.1s ease-in-out infinite;
    }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `,
  template: `
    <div class="message-row" [class.assistant]="message().role === 'assistant'">
      <div class="message-inner">
        <div class="avatar" [class.user]="message().role === 'user'" [class.ai]="message().role === 'assistant'">
          @if (message().role === 'user') {
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          }
        </div>

        <div class="content">
          <div class="role-label" [class.user]="message().role === 'user'" [class.ai]="message().role === 'assistant'">
            {{ message().role === 'user' ? 'You' : 'Code AI' }}
          </div>
          @if (message().role === 'user') {
            <div class="user-text">{{ message().content }}</div>
          } @else if (streaming() && !message().content.trim()) {
            <div class="typing" aria-label="Generating">
              <span></span><span></span><span></span>
            </div>
          } @else if (showErrorPlain()) {
            <p class="ai-error">{{ message().content }}</p>
          } @else {
            <div class="ai-text markdown-body" [innerHTML]="renderedHtml()"></div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ChatMessageComponent implements OnInit, OnChanges {
  message = input.required<Message>();
  /** True while the assistant reply is still streaming (only meaningful for the last bubble). */
  streaming = input(false);
  renderedHtml = signal('');
  showErrorPlain = computed(() => {
    const c = this.message().content || '';
    return this.message().role === 'assistant' && isProviderErrorText(c);
  });

  ngOnInit(): void {
    this.renderMarkdown();
  }

  ngOnChanges(): void {
    this.renderMarkdown();
  }

  private renderMarkdown(): void {
    if (this.message().role === 'assistant' && !isProviderErrorText(this.message().content)) {
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
        const highlighted = hljs.highlight(text, { language }).value;
        return `<pre><div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;font-size:12px;color:var(--text-muted);background:rgba(108,99,255,0.08);border-bottom:1px solid var(--border-color);border-radius:12px 12px 0 0;"><span style="font-weight:600">${language}</span></div><code class="hljs language-${language}">${highlighted}</code></pre>`;
      };

      marked.setOptions({ renderer, breaks: true });
      const html = marked.parse(this.message().content || '') as string;
      this.renderedHtml.set(html);
    } else {
      this.renderedHtml.set('');
    }
  }
}
