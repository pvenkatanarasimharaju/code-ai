import { Router, Response } from 'express';
import prisma from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createAIProvider,
  getAvailableProviders,
  ChatMessage,
  cooldownModel,
  pickFallbackModel,
  isRetryableError,
  resolveProviderModel,
  getModelDisplayName,
  coerceModelForProvider,
  pickAlternateProvider,
} from '../services/ai-provider';

function logStreamFailure(
  phase: string,
  providerId: string,
  modelId: string,
  err: unknown,
): void {
  const e = err as { message?: string; status?: number };
  const msg = e?.message ?? String(err);
  const statusPart = e?.status != null ? ` status=${e.status}` : '';
  console.error(`[ai-stream] ${phase} provider=${providerId} model=${modelId}${statusPart}: ${msg}`);
}

const router = Router();

router.use(authMiddleware);

router.get('/providers', (_req: AuthRequest, res: Response) => {
  try {
    res.json({ providers: getAvailableProviders() });
  } catch (err) {
    console.error('Get providers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json({ conversations });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const conversation = await prisma.conversation.create({
      data: {
        title: title || 'New Chat',
        userId: req.userId!,
      },
    });
    res.status(201).json({ conversation });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const convId = req.params.id as string;
    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, userId: req.userId! },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ conversation });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const convId = req.params.id as string;
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, userId: req.userId! },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const updated = await prisma.conversation.update({
      where: { id: convId },
      data: { title },
    });
    res.json({ conversation: updated });
  } catch (err) {
    console.error('Update conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const convId = req.params.id as string;
    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, userId: req.userId! },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    await prisma.conversation.delete({ where: { id: convId } });
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/conversations/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const { message, provider: requestedProvider, model: requestedModel } = req.body;
    const convId = req.params.id as string;
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, userId: req.userId! },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    await prisma.message.create({
      data: {
        role: 'user',
        content: message,
        conversationId: conversation.id,
      },
    });

    if (conversation.messages.length === 0) {
      const titleSnippet = message.length > 50 ? message.substring(0, 50) + '...' : message;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { title: titleSnippet },
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const history: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful AI assistant. Respond using markdown formatting when appropriate. Use code blocks with language tags for code.' },
      ...conversation.messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Resolve provider: use client selection, fall back to first available
    const available = getAvailableProviders();
    let streamingProviderId =
      (requestedProvider && available.some(p => p.id === requestedProvider)
        ? requestedProvider
        : available[0]?.id) as string | undefined;

    let fullResponse = '';
    const triedModels = new Set<string>();
    const currentModel =
      streamingProviderId != null
        ? coerceModelForProvider(streamingProviderId, requestedModel) ?? undefined
        : undefined;

    const tryStream = async (requested?: string): Promise<boolean> => {
      if (!streamingProviderId) return false;
      const pid = streamingProviderId;
      const resolved = resolveProviderModel(pid, requested);
      triedModels.add(resolved);
      res.write(
        `data: ${JSON.stringify({
          model: resolved,
          modelLabel: getModelDisplayName(pid, resolved),
          provider: pid,
        })}\n\n`,
      );
      const provider = createAIProvider(pid, requested?.trim() || undefined);
      for await (const chunk of provider.streamChat(history)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      return true;
    };

    try {
      if (!streamingProviderId) throw new Error('No AI provider is configured on the server.');

      let success = false;
      try {
        success = await tryStream(currentModel);
      } catch (firstErr) {
        if (isRetryableError(firstErr) && streamingProviderId === 'openrouter') {
          const resolvedFirst = resolveProviderModel(streamingProviderId, currentModel);
          logStreamFailure('openrouter-initial-before-fallback', streamingProviderId, resolvedFirst, firstErr);
          console.warn(`[retry] ${resolvedFirst} failed (retryable), trying other OpenRouter models…`);
          cooldownModel(resolvedFirst);

          let fallback = pickFallbackModel(streamingProviderId, triedModels);
          while (fallback && !success) {
            try {
              console.log(`[retry] Trying fallback model: ${fallback}`);
              res.write(
                `data: ${JSON.stringify({ content: `\n\n*Switching to ${fallback}…*\n\n` })}\n\n`,
              );
              success = await tryStream(fallback);
            } catch (retryErr) {
              if (isRetryableError(retryErr)) {
                logStreamFailure('openrouter-fallback-failed', streamingProviderId, fallback, retryErr);
                console.warn(`[retry] ${fallback} cooled down; picking next model if any`);
                cooldownModel(fallback);
                fallback = pickFallbackModel(streamingProviderId, triedModels);
              } else {
                logStreamFailure('openrouter-fallback-non-retryable', streamingProviderId, fallback, retryErr);
                throw retryErr;
              }
            }
          }
        } else if (firstErr && isRetryableError(firstErr)) {
          const mid = resolveProviderModel(streamingProviderId!, currentModel);
          logStreamFailure('initial-before-provider-switch', streamingProviderId!, mid, firstErr);
        }
        if (!success && isRetryableError(firstErr)) {
          const alt = pickAlternateProvider(streamingProviderId!);
          if (alt) {
            const prevPid = streamingProviderId;
            console.warn(
              `[retry] Switching provider ${prevPid} -> ${alt.id} (${alt.name}) after stream errors`,
            );
            streamingProviderId = alt.id;
            triedModels.clear();
            res.write(
              `data: ${JSON.stringify({
                content: `\n\n*Switching to ${alt.name}…*\n\n`,
              })}\n\n`,
            );
            try {
              success = await tryStream(undefined);
            } catch (altErr) {
              const mid = resolveProviderModel(streamingProviderId, undefined);
              logStreamFailure('after-provider-switch', streamingProviderId, mid, altErr);
              throw altErr;
            }
          }
        }
        if (!success) throw firstErr;
      }
    } catch (aiErr) {
      const err = aiErr as { message?: string; status?: number; cause?: unknown };
      const detail = err?.message || String(aiErr);
      console.error('AI provider error:', detail, err?.status != null ? `status=${err.status}` : '');
      const blocked =
        detail.startsWith('Request was blocked') || detail.startsWith('Generation stopped');
      const quota =
        /429|Too Many Requests|quota|rate.?limit|free_tier_requests/i.test(detail) &&
        detail.length < 800;
      const safeToEcho =
        process.env.NODE_ENV !== 'production' &&
        detail.length > 0 &&
        detail.length < 500 &&
        !/sk-|AIza|secret|password/i.test(detail);
      const errorMsg = blocked
        ? detail
        : quota
          ? 'All free models are rate-limited right now. Please wait a minute and try again.'
          : safeToEcho
            ? detail
            : 'Sorry, I encountered an error generating a response. Please check your AI provider configuration.';
      fullResponse = errorMsg;
      res.write(`data: ${JSON.stringify({ content: errorMsg })}\n\n`);
    }

    await prisma.message.create({
      data: {
        role: 'assistant',
        content: fullResponse,
        conversationId: conversation.id,
      },
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error('Send message error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    }
  }
});

export { router as chatRoutes };
