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
    // Only `:free` ids returned by OpenRouter /api/v1/models (max_price=0). Larger / specialty
    // free endpoints often return 400 unless requests avoid a standalone `system` message.
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen 3 Next 80B' },
      { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B' },
      { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B' },
      { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano 30B' },
      { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air' },
      { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B' },
      { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B' },
      { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B' },
      { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B' },
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B' },
      { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Model cooldown tracker — temporarily hides models that return 429 / 400
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 65_000; // 65 seconds (free tier resets every 60s)

const modelCooldowns = new Map<string, number>();

export function cooldownModel(modelId: string): void {
  modelCooldowns.set(modelId, Date.now() + COOLDOWN_MS);
  console.warn(`[cooldown] ${modelId} on cooldown for ${COOLDOWN_MS / 1000}s`);
}

export function isModelCoolingDown(modelId: string): boolean {
  const until = modelCooldowns.get(modelId);
  if (!until) return false;
  if (Date.now() >= until) {
    modelCooldowns.delete(modelId);
    return false;
  }
  return true;
}

function filterCooldowns(models: ProviderModelInfo[]): ProviderModelInfo[] {
  return models.filter(m => !isModelCoolingDown(m.id));
}

/**
 * Returns providers whose API key is present in env.
 * Models on cooldown are filtered out; provider is omitted if all its models are cooled down.
 */
export function getAvailableProviders(): ProviderInfo[] {
  const result: ProviderInfo[] = [];
  for (const [id, cat] of Object.entries(PROVIDER_CATALOG)) {
    if (!process.env[cat.envKey]?.trim()) continue;
    const envModel = process.env[cat.envModelKey]?.trim();
    const allModels = [...cat.models];
    if (envModel && !allModels.some(m => m.id === envModel)) {
      allModels.unshift({ id: envModel, name: envModel });
    }
    const models = filterCooldowns(allModels);
    if (models.length === 0) continue;
    const defaultModel =
      models.some(m => m.id === (envModel || cat.defaultModel))
        ? (envModel || cat.defaultModel)
        : models[0].id;
    result.push({ id, name: cat.name, models, defaultModel });
  }
  return result;
}

/** Pick next available model for a provider, excluding already-tried ones. */
export function pickFallbackModel(providerId: string, triedModels: Set<string>): string | null {
  const cat = PROVIDER_CATALOG[providerId];
  if (!cat) return null;
  for (const m of cat.models) {
    if (!triedModels.has(m.id) && !isModelCoolingDown(m.id)) return m.id;
  }
  return null;
}

/** Another configured provider that still has at least one active (non-cooldown) model. */
export function pickAlternateProvider(excludeProviderId: string): ProviderInfo | null {
  for (const p of getAvailableProviders()) {
    if (p.id !== excludeProviderId && p.models.length > 0) return p;
  }
  return null;
}

/** Same resolution as createAIProvider — id actually sent to the API. */
export function resolveProviderModel(providerId: string, requested?: string): string {
  const cat = PROVIDER_CATALOG[providerId];
  if (!cat) return (requested || '').trim();
  const t = requested?.trim();
  if (t) return t;
  const envModel = process.env[cat.envModelKey]?.trim();
  return envModel || cat.defaultModel;
}

export function getModelDisplayName(providerId: string, modelId: string): string {
  if (!modelId) return 'Model';
  const cat = PROVIDER_CATALOG[providerId];
  if (!cat) return modelId;
  const m = cat.models.find(x => x.id === modelId);
  return m?.name ?? modelId;
}

/** True if this model id is allowed for the given provider (catalog or optional env override). */
export function isModelAllowedForProvider(providerId: string, modelId: string): boolean {
  const cat = PROVIDER_CATALOG[providerId];
  if (!cat || !modelId) return false;
  const envModel = process.env[cat.envModelKey]?.trim();
  if (envModel && modelId === envModel) return true;
  return cat.models.some(m => m.id === modelId);
}

/**
 * Returns the requested model only if it belongs to this provider; otherwise undefined
 * so the caller uses the provider default (avoids e.g. Gemini + OpenRouter model id → 404).
 */
export function coerceModelForProvider(providerId: string, requested?: string): string | undefined {
  const t = requested?.trim();
  if (!t) return undefined;
  if (isModelAllowedForProvider(providerId, t)) return t;
  console.warn(
    `[ai] Model "${t}" is not valid for provider "${providerId}"; using provider default.`,
  );
  return undefined;
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

/** Returns true if the error status/message means the model should be cooled down and retried. */
export function isRetryableError(err: unknown): boolean {
  const e = err as { message?: string; status?: number };
  const msg = e?.message || String(err);
  const status = e?.status;
  if (status === 429 || status === 400) return true;
  return /429|Too Many Requests|rate.?limit|400|Provider returned error/i.test(msg);
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

  /**
   * Many free routed models return 400 on a standalone `system` message. Merge the system
   * prompt into the **first** user turn so behavior stays global without `role: system`.
   */
  private buildOpenRouterMessages(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n')
      .trim();
    const dialog = messages.filter(m => m.role !== 'system');
    const out = dialog.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    if (!systemText) return out;

    const firstUserIdx = out.findIndex(m => m.role === 'user');
    if (firstUserIdx >= 0) {
      const u = out[firstUserIdx];
      out[firstUserIdx] = { role: 'user', content: `${systemText}\n\n---\n\n${u.content}` };
      return out;
    }
    return [{ role: 'user', content: systemText }, ...out];
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const apiMessages = this.buildOpenRouterMessages(messages);
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: apiMessages,
      max_tokens: 4096,
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
