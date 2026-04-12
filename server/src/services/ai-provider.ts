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
 * Gemini: systemInstruction on the model (not as a fake "user" in history).
 * Default model is a current Flash id; gemini-pro is deprecated on the Generative Language API.
 *
 * Stream chunks from @google/generative-ai must not use chunk.text(): it throws on
 * SAFETY / RECITATION / LANGUAGE finish reasons and on promptFeedback blocks, which
 * breaks streaming intermittently in production even with a valid API key.
 *
 * Gemini 2.5 may emit thought-only parts first; skip parts with thought: true.
 * Do not treat BLOCK_REASON_UNSPECIFIED as a block (some chunks carry it without blocking).
 */
function extractGeminiStreamChunkText(chunk: unknown): string {
  const r = chunk as {
    candidates?: Array<{
      finishReason?: string;
      finishMessage?: string;
      content?: { parts?: Array<{ text?: string; thought?: boolean }> } | null;
    }>;
    promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
  };

  const br = r.promptFeedback?.blockReason;
  const meaningfulBlock =
    br &&
    br !== 'BLOCK_REASON_UNSPECIFIED' &&
    br !== 'HARM_BLOCK_THRESHOLD_UNSPECIFIED';

  if ((!r.candidates || r.candidates.length === 0) && meaningfulBlock) {
    const msg = r.promptFeedback?.blockReasonMessage || '';
    console.warn('[gemini] prompt blocked:', br, msg);
    throw new Error(`Request was blocked (${br}). Try rephrasing your message.`);
  }

  const c0 = r.candidates?.[0];
  if (!c0) return '';

  const parts = c0.content?.parts;
  let out = '';
  if (parts?.length) {
    for (const p of parts) {
      if (p.thought === true) continue;
      if (typeof p.text === 'string' && p.text.length) out += p.text;
    }
  }

  const fr = c0.finishReason;
  const hardStop = new Set([
    'SAFETY',
    'RECITATION',
    'LANGUAGE',
    'BLOCKLIST',
    'PROHIBITED_CONTENT',
    'SPII',
  ]);
  if (fr && hardStop.has(fr)) {
    if (out) return out;
    const fm = c0.finishMessage || '';
    console.warn('[gemini] blocked finish:', fr, fm);
    throw new Error(`Generation stopped (${fr}). Try a different prompt.`);
  }

  return out;
}

/** Final aggregated response from sendMessageStream — same safe extraction. */
function extractGeminiFinalResponseText(response: unknown): string {
  return extractGeminiStreamChunkText(response);
}

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
    this.modelName = (process.env.GEMINI_MODEL || 'gemini-3-flash-preview').trim();
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
      // Gemini 2.5 Flash defaults to "thinking"; stream chunks can be thought-only so clients
      // see no text until late. thinkingBudget 0 disables thinking for stable chat streaming.
      // Set GEMINI_USE_THINKING=true to keep default model thinking instead.
      generationConfig: {
        maxOutputTokens: 8192,
        ...(String(this.modelName).includes('2.5') &&
        !/^true$/i.test(process.env.GEMINI_USE_THINKING || '')
          ? { thinkingConfig: { thinkingBudget: 0 } }
          : {}),
      } as Record<string, unknown>,
    });

    const contentsForFallback = dialog.map(m => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }));

    let yielded = false;
    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(last.content);

      for await (const chunk of result.stream) {
        const t = extractGeminiStreamChunkText(chunk);
        if (t) {
          yielded = true;
          yield t;
        }
      }

      if (!yielded) {
        try {
          const final = await result.response;
          const tail = extractGeminiFinalResponseText(final);
          if (tail) yield tail;
        } catch (e) {
          console.error('[gemini] empty stream; aggregated response failed:', (e as Error)?.message || e);
          throw e;
        }
      }
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      const useNonStreamFallback =
        !yielded &&
        (/Failed to parse stream|parse stream|Error reading from the stream/i.test(msg) ||
          /fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg));
      if (useNonStreamFallback) {
        console.warn('[gemini] stream failed; retrying with generateContent:', msg);
        const resp = await model.generateContent({ contents: contentsForFallback });
        const r = await resp.response;
        const text = extractGeminiStreamChunkText(r);
        if (text) yield text;
        return;
      }
      throw e;
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
