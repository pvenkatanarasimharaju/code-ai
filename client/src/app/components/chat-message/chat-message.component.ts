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
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.scss',
})
export class ChatMessageComponent implements OnInit, OnChanges {
  message = input.required<Message>();
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
