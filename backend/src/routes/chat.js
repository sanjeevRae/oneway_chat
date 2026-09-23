const express = require('express');
const supabaseAdmin = require('../lib/supabase');
const { retrieveContext, trackUsage } = require('../services/rag');
const { buildSystemPrompt, getToolSchemas, runChatTurn } = require('../services/groq');
const { createToolExecutor } = require('../services/tools');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/chat
 * Public endpoint used by the embeddable widget & test chat.
 * Body: { orgId, sessionId, message, channel? }
 */
router.post('/', async (req, res) => {
  try {
    const { orgId, sessionId, message, channel = 'web' } = req.body;
    if (!orgId || !sessionId || !message) {
      return res.status(400).json({ error: 'orgId, sessionId and message are required' });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    /*
      One parallel batch instead of six sequential round trips.

      Previously org -> settings -> usage count -> org again (plan) -> RAG ->
      history ran one after another, so every single message paid several
      hundred ms of dead waiting time before the LLM was even called. None of
      these queries depend on each other, so they now go out together.
    */
    const [orgRes, settingsRes, usageRes, historyRes, contextChunks] = await Promise.all([
      // Org + quota columns in one read (this was two separate queries).
      supabaseAdmin
        .from('organizations')
        .select('id, name, industry, monthly_message_quota')
        .eq('id', orgId)
        .single(),

      supabaseAdmin
        .from('settings')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle(),

      supabaseAdmin
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('event_type', 'message')
        .gte('created_at', monthStart.toISOString()),

      supabaseAdmin
        .from('chat_history')
        .select('role, message')
        .eq('organization_id', orgId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(10),

      // A retrieval failure must never break the reply.
      retrieveContext(orgId, message).catch((err) => {
        console.warn('RAG lookup failed, answering without knowledge:', err.message);
        return [];
      }),
    ]);

    const org = orgRes.data;
    if (orgRes.error || !org) return res.status(404).json({ error: 'Business not found' });

    const settings = settingsRes.data;

    // ---- Free-tier quota check (messages/month) ----
    const msgCount = usageRes.count || 0;
    const messageQuota = org.monthly_message_quota ?? config.freeTierQuotas.messagesPerMonth;

    if (msgCount >= messageQuota) {
      return res.status(429).json({
        error: 'This business has reached its monthly message limit. Please try again later.',
        quota_exceeded: true,
        limit: messageQuota,
      });
    }

    const priorMessages = (historyRes.data || [])
      .slice()
      .reverse()
      .map((h) => ({
        role: h.role,
        content: h.message,
      }));

    // ---- LLM turn with tools ----
    const messages = [
      { role: 'system', content: buildSystemPrompt(org, settings, contextChunks, channel) },
      ...priorMessages,
      { role: 'user', content: message },
    ];

    const executeTool = createToolExecutor(orgId, org, settings, { sessionId });

    let result;
    try {
      result = await runChatTurn({
        messages,
        tools: getToolSchemas(),
        executeTool,
      });
    } catch (llmErr) {
      console.error('Groq error:', llmErr.message);
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    /*
      Reply first, persist after.

      Saving the transcript and bumping the usage counter used to sit between
      the model finishing and the browser seeing the answer, so every message
      waited on two more Supabase round trips. They now run in the background
      once the response is already on the wire.
    */
    res.json({
      reply: result.reply,
      actions: result.toolCallsExecuted,
      sources: contextChunks.map((c) => c.id),
      provider: result.provider,
    });

    Promise.allSettled([
      supabaseAdmin.from('chat_history').insert([
        { organization_id: orgId, session_id: sessionId, role: 'user', message, channel },
        { organization_id: orgId, session_id: sessionId, role: 'assistant', message: result.reply, channel },
      ]),
      trackUsage(orgId, 'message'),
    ]).then((outcomes) => {
      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') {
          console.error('Post-reply persistence failed:', outcome.reason?.message || outcome.reason);
        } else if (outcome.value?.error) {
          console.error('Post-reply persistence failed:', outcome.value.error.message);
        }
      }
    });
  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/config/:orgId
 * Public bot configuration (bot name + welcome message) for the
 * embeddable widget and hosted bot page. Only exposes settings
 * that are safe to be public.
 */
router.get('/config/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;

    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('bot_name, welcome_message')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (error) throw error;

    res.json({
      botName: settings?.bot_name || null,
      welcomeMessage: settings?.welcome_message || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load bot config' });
  }
});

module.exports = router;
