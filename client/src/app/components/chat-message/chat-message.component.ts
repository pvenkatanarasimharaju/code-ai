import { Component, input, OnInit, OnChanges, signal } from '@angular/core';
import { Message } from '../../services/chat.service';
import { marked } from 'marked';
import hljs from 'highlight.js';

@Component({
  selector: 'app-chat-message',
  template: `
    <div class="py-5 px-4" [class]="message().role === 'user' ? '' : ''">
      <div class="max-w-3xl mx-auto flex gap-4">
        <!-- Avatar -->
        <div
          class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          [class]="message().role === 'user' ? 'bg-blue-600' : 'bg-[var(--accent)]'"
        >
          {{ message().role === 'user' ? 'U' : 'AI' }}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium mb-1" [class]="message().role === 'user' ? 'text-blue-400' : 'text-[var(--accent)]'">
            {{ message().role === 'user' ? 'You' : 'Assistant' }}
          </div>
          @if (message().role === 'user') {
            <div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{{ message().content }}</div>
          } @else {
            <div class="markdown-body text-[var(--text-primary)]" [innerHTML]="renderedHtml()"></div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ChatMessageComponent implements OnInit, OnChanges {
  message = input.required<Message>();
  renderedHtml = signal('');

  ngOnInit(): void {
    this.renderMarkdown();
  }

  ngOnChanges(): void {
    this.renderMarkdown();
  }

  private renderMarkdown(): void {
    if (this.message().role === 'assistant') {
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
        const highlighted = hljs.highlight(text, { language }).value;
        return `<pre><div class="flex items-center justify-between px-4 py-2 text-xs text-[var(--text-muted)] bg-[#2d2d2d] rounded-t-lg"><span>${language}</span></div><code class="hljs language-${language}">${highlighted}</code></pre>`;
      };

      marked.setOptions({ renderer, breaks: true });
      const html = marked.parse(this.message().content || '') as string;
      this.renderedHtml.set(html);
    }
  }
}
