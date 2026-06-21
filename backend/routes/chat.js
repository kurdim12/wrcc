// /api/v1/chat - AI Assistant. Receives the user's message + chat history,
// gathers live sensor context, and forwards to OpenRouter.
import { Router } from 'express';
import { z } from 'zod';
import * as chat from '../services/chat.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({
    ready: chat.isReady(),
    provider: 'openrouter',
    model: process.env.PG_OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  });
});

const ChatSchema = z.object({
  message:   z.string().min(1).max(4000).optional(),
  messages:  z.array(z.object({
    role:    z.enum(['user', 'assistant', 'system']),
    content: z.string().optional(),
    text:    z.string().optional(),
  })).optional(),
  device_id: z.string().optional(),
});

router.post('/', async (req, res) => {
  const parse = ChatSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  if (!parse.data.message && !parse.data.messages?.length) {
    return res.status(400).json({ error: 'message_required' });
  }
  try {
    const reply = await chat.ask(parse.data);
    res.json({ ok: true, ...reply });
  } catch (e) {
    console.error('[chat] error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

export default router;
