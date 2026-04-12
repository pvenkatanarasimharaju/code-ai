export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  streamChat(messages: ChatMessage[]): AsyncIterable<string>;
}

let providerInstance: AIProvider | null = null;
let cachedForProviderKey: string | null = null;

/** Clears cached provider (e.g. after env reload in tests). */
export function resetAIProviderCache(): void {
  providerInstance = null;
  cachedForProviderKey = null;
}

/**
 * Resolves which backend to use. Supports gemini/google, anthropic/claude, openai/gpt.
 * If AI_PROVIDER is unset, picks the first provider that has an API key (Gemini first).
 * If AI_PROVIDER is openai but only GEMINI_API_KEY is set, falls back to Gemini.
 */
export function getActiveProviderName(): string {
  const raw = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const hasOpenai = !!process.env.OPENAI_API_KEY?.trim();
  const hasGemini = !!process.env.GEMINI_API_KEY?.trim();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();

  if (raw === 'anthropic' || raw === 'claude') return 'anthropic';
  if (raw === 'gemini' || raw === 'google') return 'gemini';
  if (raw === 'openai' || raw === 'gpt') {
    if (!hasOpenai && hasGemini) {
      console.warn('[ai] AI_PROVIDER is openai but OPENAI_API_KEY is empty; using Gemini instead.');
      return 'gemini';
    }
    return 'openai';
  }

  if (!raw) {
    if (hasGemini) return 'gemini';
    if (hasAnthropic) return 'anthropic';
    if (hasOpenai) return 'openai';
    return 'openai';
  }

  console.warn(`[ai] Unknown AI_PROVIDER="${process.env.AI_PROVIDER}", defaulting to openai`);
  return 'openai';
}

function resolvedProviderKey(): string {
  return `${getActiveProviderName()}|${process.env.OPENAI_API_KEY?.length || 0}|${process.env.GEMINI_API_KEY?.length || 0}|${process.env.ANTHROPIC_API_KEY?.length || 0}`;
}

export function isActiveProviderConfigured(): boolean {
  const p = getActiveProviderName();
  if (p === 'anthropic') return !!process.env.ANTHROPIC_API_KEY?.trim();
  if (p === 'gemini') return !!process.env.GEMINI_API_KEY?.trim();
  return !!process.env.OPENAI_API_KEY?.trim();
}

export function logAiEnvStatus(): void {
  const p = getActiveProviderName();
  const ok = isActiveProviderConfigured();
  console.log(`[ai] AI_PROVIDER(raw)=${JSON.stringify(process.env.AI_PROVIDER || '')}, resolved=${p}, apiKeyConfigured=${ok}`);
  if (!ok) {
    const keyName =
      p === 'anthropic' ? 'ANTHROPIC_API_KEY' : p === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    console.warn(`[ai] Set ${keyName} in server/.env (see server/.env.example)`);
  }
}

class OpenAIProvider implements AIProvider {
  private client: any;

  constructor() {
    const OpenAI = require('openai');
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is missing. Add it to server/.env');
    }
    this.client = new OpenAI({ apiKey });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

class AnthropicProvider implements AIProvider {
  private client: any;

  constructor() {
    const Anthropic = require('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is missing. Add it to server/.env');
    }
    this.client = new Anthropic.default({ apiKey });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system: systemMsg?.content || 'You are a helpful AI assistant.',
      messages: nonSystemMsgs.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

/**
 * Gemini: use systemInstruction on the model (not as a fake "user" in history).
 * Default model is a current Flash id; gemini-pro is deprecated on the Generative Language API.
 */
class GeminiProvider implements AIProvider {
  private genAI: any;
  private modelName: string;

  constructor() {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing. Add it to server/.env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Unversioned ids like gemini-1.5-flash often 404 on v1beta; use current stable id (see https://ai.google.dev/gemini-api/docs/models/gemini )
    this.modelName = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n')
      .trim();

    const dialog = messages.filter(m => m.role !== 'system');
    if (dialog.length === 0) {
      return;
    }

    const last = dialog[dialog.length - 1];
    if (last.role !== 'user') {
      throw new Error('Gemini expects the last message to be from the user');
    }

    const prior = dialog.slice(0, -1);
    const history: { role: string; parts: { text: string }[] }[] = [];
    for (const m of prior) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      history.push({ role, parts: [{ text: m.content }] });
    }

    if (history.length > 0 && history[0].role !== 'user') {
      throw new Error(
        'Gemini chat history must start with a user turn. Check stored messages for this conversation.'
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      ...(systemText ? { systemInstruction: systemText } : {}),
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(last.content);

    for await (const chunk of result.stream) {
      try {
        const textFn = (chunk as { text?: () => string }).text;
        const t = typeof textFn === 'function' ? textFn.call(chunk) : '';
        if (t) yield t;
      } catch (e: unknown) {
        const err = e as { message?: string };
        console.error('[gemini] chunk error:', err?.message || e);
        throw e;
      }
    }
  }
}

export function getAIProvider(): AIProvider {
  const key = resolvedProviderKey();
  if (providerInstance && cachedForProviderKey !== key) {
    providerInstance = null;
  }
  if (providerInstance) {
    return providerInstance;
  }

  const provider = getActiveProviderName();
  switch (provider) {
    case 'anthropic':
      providerInstance = new AnthropicProvider();
      break;
    case 'gemini':
      providerInstance = new GeminiProvider();
      break;
    case 'openai':
    default:
      providerInstance = new OpenAIProvider();
      break;
  }
  cachedForProviderKey = key;
  return providerInstance;
}
