import { Component, input, OnInit, OnChanges, signal, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message } from '../../services/chat.service';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import hljs from 'highlight.js';

marked.use(
  markedKatex({
    throwOnError: false,
    output: 'mathml',
    nonStandard: true,
  }),
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toClipboardB64(text: string): string {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return '';
  }
}

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
  private sanitizer = inject(DomSanitizer);

  message = input.required<Message>();
  streaming = input(false);
  renderedHtml = signal('');
  safeRenderedHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.renderedHtml() || ''),
  );
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

  onMarkdownClick(ev: MouseEvent): void {
    const btn = (ev.target as HTMLElement | null)?.closest?.('.code-copy-btn') as HTMLButtonElement | null;
    if (!btn) return;
    ev.preventDefault();
    const b64 = btn.getAttribute('data-code-b64');
    if (!b64) return;
    try {
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      void navigator.clipboard.writeText(text).then(
        () => {
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = 'Copy';
          }, 2000);
        },
        () => {
          btn.textContent = 'Failed';
          setTimeout(() => {
            btn.textContent = 'Copy';
          }, 2000);
        },
      );
    } catch {
      btn.textContent = 'Failed';
      setTimeout(() => {
        btn.textContent = 'Copy';
      }, 2000);
    }
  }

  private renderMarkdown(): void {
    if (this.message().role === 'assistant' && !isProviderErrorText(this.message().content)) {
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
        const highlighted = hljs.highlight(text, { language }).value;
        const langLabel = escapeHtml(language);
        const langClass = (language || 'plaintext').replace(/[^a-z0-9_-]/gi, '') || 'plaintext';
        const b64 = toClipboardB64(text);
        const b64Attr = b64 ? ` data-code-b64="${b64}"` : '';
        return (
          `<div class="code-block-wrap">` +
          `<div class="code-block-header">` +
          `<span class="code-block-lang">${langLabel}</span>` +
          `<button type="button" class="code-copy-btn"${b64Attr} aria-label="Copy code">Copy</button>` +
          `</div>` +
          `<pre class="code-block-pre"><code class="hljs language-${langClass}">${highlighted}</code></pre>` +
          `</div>`
        );
      };

      marked.setOptions({ renderer, breaks: true });
      const html = marked.parse(this.message().content || '') as string;
      this.renderedHtml.set(html);
    } else {
      this.renderedHtml.set('');
    }
  }
}
