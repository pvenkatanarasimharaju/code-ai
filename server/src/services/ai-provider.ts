export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  streamChat(messages: ChatMessage[]): AsyncIterable<string>;
}

class OpenAIProvider implements AIProvider {
  private client: any;

  constructor() {
    const OpenAI = require('openai');
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
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
    this.client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
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

class GeminiProvider implements AIProvider {
  private model: any;

  constructor() {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-pro',
    });
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = this.model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (providerInstance) return providerInstance;

  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
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
  return providerInstance;
}
