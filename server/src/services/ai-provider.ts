export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  streamChat(messages: ChatMessage[]): AsyncIterable<string>;
}

export interface ProviderModelInfo {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ProviderModelInfo[];
  defaultModel: string;
}

const PROVIDER_CATALOG: Record<
  string,
  {
    name: string;
    envKey: string;
    envModelKey: string;
    defaultModel: string;
    models: ProviderModelInfo[];
  }
> = {
  gemini: {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    envModelKey: 'GEMINI_MODEL',
    // Stable ids per https://ai.google.dev/gemini-api/docs/models — gemini-1.5-* returns 404 on v1beta for many keys.
    defaultModel: 'gemini-3-flash-preview',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (preview)' },
    ],
  },
  openai: {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    envModelKey: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    envModelKey: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-3-haiku-20240307',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    envModelKey: 'OPENROUTER_MODEL',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B' },
      { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder 480B' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen 3 Next 80B' },
      { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B' },
      { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B' },
      { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B' },
      { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano 30B' },
      { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air' },
      { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B' },
    ],
  },
};

/**
 * Returns providers whose API key is present in env.
 * If a *_MODEL env var is set and not already in the built-in list, it is prepended.
 */
export function getAvailableProviders(): ProviderInfo[] {
  const result: ProviderInfo[] = [];
  for (const [id, cat] of Object.entries(PROVIDER_CATALOG)) {
    if (!process.env[cat.envKey]?.trim()) continue;
    const envModel = process.env[cat.envModelKey]?.trim();
    const defaultModel = envModel || cat.defaultModel;
    const models = [...cat.models];
    if (envModel && !models.some(m => m.id === envModel)) {
      models.unshift({ id: envModel, name: envModel });
    }
    result.push({ id, name: cat.name, models, defaultModel });
  }
  return result;
}

export function getDefaultProvider(): string | null {
  const providers = getAvailableProviders();
  return providers.length > 0 ? providers[0].id : null;
}

export function logAiEnvStatus(): void {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    console.warn(
      '[ai] No AI providers configured. Set at least one API key ' +
        '(GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY).',
    );
    return;
  }
  const names = providers.map(p => `${p.id}(${p.defaultModel})`).join(', ');
  console.log(`[ai] Available providers: ${names}`);
}

// ---------------------------------------------------------------------------
// Gemini helpers — chunk.text() throws on certain finishReasons / promptFeedback,
// so we extract text manually from content.parts.
// ---------------------------------------------------------------------------

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

function extractGeminiFinalResponseText(response: unknown): string {
  return extractGeminiStreamChunkText(response);
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

class OpenAIProvider implements AIProvider {
  private client: any;

  constructor(private model: string) {
    const OpenAI = require('openai');
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENAI_API_KEY is missing. Add it to server/.env');
    this.client = new OpenAI({ apiKey });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
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

  constructor(private model: string) {
    const Anthropic = require('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing. Add it to server/.env');
    this.client = new Anthropic.default({ apiKey });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: this.model,
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

class OpenRouterProvider implements AIProvider {
  private client: any;

  constructor(private model: string) {
    const OpenAI = require('openai');
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing. Add it to server/.env');
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:4200',
        'X-OpenRouter-Title': 'Code AI Chat',
      },
    });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

class GeminiProvider implements AIProvider {
  private genAI: any;

  constructor(private modelName: string) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Add it to server/.env');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n')
      .trim();

    const dialog = messages.filter(m => m.role !== 'system');
    if (dialog.length === 0) return;

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
        'Gemini chat history must start with a user turn. Check stored messages for this conversation.',
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      ...(systemText ? { systemInstruction: systemText } : {}),
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
          console.error(
            '[gemini] empty stream; aggregated response failed:',
            (e as Error)?.message || e,
          );
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

// ---------------------------------------------------------------------------
// Provider factory with instance cache
// ---------------------------------------------------------------------------

const providerCache = new Map<string, AIProvider>();

export function createAIProvider(providerId: string, model?: string): AIProvider {
  const cat = PROVIDER_CATALOG[providerId];
  if (!cat) throw new Error(`Unknown AI provider: ${providerId}`);

  const apiKey = process.env[cat.envKey]?.trim();
  if (!apiKey) throw new Error(`${cat.envKey} is not set. Cannot use ${cat.name}.`);

  const resolvedModel = model || process.env[cat.envModelKey]?.trim() || cat.defaultModel;
  const cacheKey = `${providerId}:${resolvedModel}`;

  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  let provider: AIProvider;
  switch (providerId) {
    case 'openai':
      provider = new OpenAIProvider(resolvedModel);
      break;
    case 'anthropic':
      provider = new AnthropicProvider(resolvedModel);
      break;
    case 'gemini':
      provider = new GeminiProvider(resolvedModel);
      break;
    case 'openrouter':
      provider = new OpenRouterProvider(resolvedModel);
      break;
    default:
      throw new Error(`Unknown AI provider: ${providerId}`);
  }

  providerCache.set(cacheKey, provider);
  return provider;
}

/** Auto-select first available provider (backwards compat). */
export function getAIProvider(): AIProvider {
  const defaultProv = getDefaultProvider();
  if (!defaultProv) throw new Error('No AI provider configured. Set at least one API key.');
  return createAIProvider(defaultProv);
}
