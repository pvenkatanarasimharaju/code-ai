import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ProviderModel[];
  defaultModel: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly conversations = signal<Conversation[]>([]);
  readonly activeConversation = signal<Conversation | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly isStreaming = signal(false);
  readonly streamingContent = signal('');

  readonly providers = signal<ProviderInfo[]>([]);
  readonly selectedProvider = signal('');
  readonly selectedModel = signal('');

  constructor(private http: HttpClient, private auth: AuthService) {}

  /** Clear all in-memory chat state (call on logout / before loading data for a new account). */
  resetSession(): void {
    this.conversations.set([]);
    this.activeConversation.set(null);
    this.messages.set([]);
    this.isStreaming.set(false);
    this.streamingContent.set('');
    this.providers.set([]);
    this.selectedProvider.set('');
    this.selectedModel.set('');
  }

  async loadProviders(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ providers: ProviderInfo[] }>('/api/chat/providers'),
      );
      this.providers.set(res.providers);
      if (res.providers.length === 0) return;
      const withModels = res.providers.filter(p => p.models.length > 0);
      const fallbackProv = withModels[0] ?? res.providers[0];
      let prov = res.providers.find(p => p.id === this.selectedProvider());
      if (!prov || prov.models.length === 0) {
        prov = fallbackProv;
        this.selectedProvider.set(prov.id);
      }
      const mid = this.selectedModel();
      if (!mid || !prov.models.some(m => m.id === mid)) {
        this.selectedModel.set(prov.defaultModel);
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  }

  async loadConversations(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ conversations: Conversation[] }>('/api/chat/conversations')
    );
    this.conversations.set(res.conversations);
  }

  async createConversation(): Promise<Conversation> {
    const res = await firstValueFrom(
      this.http.post<{ conversation: Conversation }>('/api/chat/conversations', { title: 'New Chat' })
    );
    this.conversations.update(convs => [res.conversation, ...convs]);
    this.activeConversation.set(res.conversation);
    this.messages.set([]);
    return res.conversation;
  }

  async selectConversation(id: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<{ conversation: Conversation & { messages: Message[] } }>(`/api/chat/conversations/${id}`)
    );
    this.activeConversation.set(res.conversation);
    this.messages.set(res.conversation.messages || []);
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(`/api/chat/conversations/${id}`, { title })
    );
    this.conversations.update(convs =>
      convs.map(c => c.id === id ? { ...c, title } : c)
    );
    const active = this.activeConversation();
    if (active?.id === id) {
      this.activeConversation.set({ ...active, title });
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/chat/conversations/${id}`)
    );
    this.conversations.update(convs => convs.filter(c => c.id !== id));
    if (this.activeConversation()?.id === id) {
      this.activeConversation.set(null);
      this.messages.set([]);
    }
  }

  async sendMessage(content: string): Promise<void> {
    let conv = this.activeConversation();
    if (!conv) {
      conv = await this.createConversation();
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    this.messages.update(msgs => [...msgs, userMessage]);

    this.isStreaming.set(true);
    this.streamingContent.set('');

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    this.messages.update(msgs => [...msgs, assistantMessage]);

    try {
      const token = this.auth.getToken();
      const response = await fetch(`/api/chat/conversations/${conv.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          provider: this.selectedProvider(),
          model: this.selectedModel(),
        }),
      });

      if (!response.ok) throw new Error('Stream request failed');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let lineBuffer = '';

      const applyChunk = (chunk: string): void => {
        fullContent += chunk;
        this.streamingContent.set(fullContent);
        this.messages.update(msgs => {
          const updated = [...msgs];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: fullContent };
          }
          return updated;
        });
      };

      const processSseLine = (rawLine: string): void => {
        const line = rawLine.replace(/\r$/, '');
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data) as {
            content?: string;
            model?: string;
            modelLabel?: string;
            provider?: string;
          };
          if (parsed.model) {
            if (parsed.provider) this.selectedProvider.set(parsed.provider);
            this.selectedModel.set(parsed.model);
            void this.loadProviders();
          }
          if (parsed.content) applyChunk(parsed.content);
        } catch {
          /* incomplete JSON — wait for more bytes in lineBuffer */
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        lineBuffer += decoder.decode(value ?? new Uint8Array(0), { stream: !done });

        let nl: number;
        while ((nl = lineBuffer.indexOf('\n')) >= 0) {
          const line = lineBuffer.slice(0, nl);
          lineBuffer = lineBuffer.slice(nl + 1);
          processSseLine(line);
        }

        if (done) break;
      }

      if (lineBuffer.trim()) {
        processSseLine(lineBuffer.trim());
      }

      if (this.conversations().find(c => c.id === conv!.id)?.title === 'New Chat') {
        const titleSnippet = content.length > 50 ? content.substring(0, 50) + '...' : content;
        this.conversations.update(convs =>
          convs.map(c => c.id === conv!.id ? { ...c, title: titleSnippet } : c)
        );
      }
    } catch (err) {
      console.error('Stream error:', err);
      this.messages.update(msgs => {
        const updated = [...msgs];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Sorry, an error occurred. Please check your AI provider configuration and try again.',
        };
        return updated;
      });
    } finally {
      this.isStreaming.set(false);
      this.streamingContent.set('');
    }
  }
}
