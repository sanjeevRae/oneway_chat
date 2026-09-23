const express = require('express');
const supabaseAdmin = require('../lib/supabase');
const { retrieveContext, trackUsage } = require('../services/rag');
const { buildSystemPrompt, getToolSchemas, runChatTurn, runChatTurnStream } = require('../services/groq');
const { createToolExecutor } = require('../services/tools');
const config = require('../config');

const router = express.Router();

/*
  Answer cache: support bots answer the same handful of questions over and
  over ("what services…", "opening hours…"). The first ask pays retrieval +
  LLM; repeats within the TTL are served from memory in ~1ms. Keyed by org +
  the org's `version` column, so editing the org implicitly invalidates.
*/
const answerCache = new Map();
const ANSWER_CACHE_TTL_MS = 10 * 60 * 1000;
const ANSWER_CACHE_MAX = 500;

function normalizeQuestion(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/*
  Transcript + usage persistence, deliberately fire-and-forget: this runs
  AFTER the reply is already on the wire (JSON path) or the stream ended
  (SSE path), so nobody ever waits on these two Supabase writes.
*/
function persistTurn({ orgId, sessionId, channel, userMessage, assistantMessage }) {
  Promise.allSettled([
    supabaseAdmin.from('chat_history').insert([
      { organization_id: orgId, session_id: sessionId, role: 'user', message: userMessage, channel },
      { organization_id: orgId, session_id: sessionId, role: 'assistant', message: assistantMessage, channel },
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
}

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
      Two-stage parallel fetch.

      STAGE 1 — org existence (+ its cache-busting `version` column) and this
      session's history, in parallel: both gate everything downstream. The
      expensive reads (usage count, retrieval) are NOT in this batch — on the
      hot path (a cached answer) they would be wasted round trips.

      STAGE 2 (miss path only) — org columns + settings + usage + retrieval,
      one batch: none of these queries depend on each other. This preserves
      the earlier optimization where six queries used to run sequentially.
    */
    let [versionRes, historyRes] = await Promise.all([
      supabaseAdmin
        .from('organizations')
        .select('id, version')
        .eq('id', orgId)
        .single(),

      supabaseAdmin
        .from('chat_history')
        .select('role, message')
        .eq('organization_id', orgId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    /*
      organizations.version may not exist yet on databases created before
      the answer cache shipped (the migration below is additive). Fall back
      to a version-less read so chat keeps working; the cache keys on v0.
    */
    if (versionRes.error && /version|column/i.test(versionRes.error.message || '')) {
      versionRes = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .single();
    }

    if (versionRes.error || !versionRes.data) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const orgVersion = versionRes.data.version ?? 0;
    const priorMessages = (historyRes.data || [])
      .slice()
      .reverse()
      .map((h) => ({ role: h.role, content: h.message }));

    /* ---- Answer cache: a hit skips usage count, retrieval AND the LLM ---- */
    const cacheKey = `${orgId}::v${orgVersion}::${normalizeQuestion(message)}`;
    const cached = answerCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      /*
        Cache hit: quota was already counted when the answer was first
        generated. For streaming clients emit the whole reply as one delta
        so the widget's SSE loop completes normally; JSON clients keep the
        original contract.
      */
      persistTurn({ orgId, sessionId, channel, userMessage: message, assistantMessage: cached.reply });
      if (wantsStream) {
        res.status(200);
        res.set({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        if (res.flushHeaders) res.flushHeaders();
        res.write(`data: ${JSON.stringify({ delta: cached.reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply: cached.reply, sessionId, actions: cached.actions || [], sources: cached.sources || [], provider: cached.provider, cached: true })}\n\n`);
        return res.end();
      }
      return res.json({
        reply: cached.reply,
        actions: cached.actions,
        sources: cached.sources,
        provider: cached.provider,
        cached: true,
      });
    }
    if (cached) answerCache.delete(cacheKey);

    const [orgRes, settingsRes, usageRes, contextChunks] = await Promise.all([
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

    // ---- LLM turn with tools ----
    const messages = [
      { role: 'system', content: buildSystemPrompt(org, settings, contextChunks, channel) },
      ...priorMessages,
      { role: 'user', content: message },
    ];

    const executeTool = createToolExecutor(orgId, org, settings, { sessionId });

    /*
      STREAMING PATH (SSE).

      When the client opts in (Accept: text/event-stream or body.stream),
      tokens are pushed the moment Groq emits them — perceived latency drops
      to first-token time (~200-400ms) instead of waiting out the whole
      completion. Tool rounds still execute; they simply emit nothing until
      the final text starts flowing. X-Accel-Buffering: no keeps nginx from
      coalescing the deltas.
    */
    const wantsStream =
      String(req.headers.accept || '').includes('text/event-stream') ||
      req.body.stream === true;

    if (wantsStream) {
      let streamed = '';
      let finalReply = '';
      let executedTools = [];
      let provider = 'groq';

      res.status(200);
      res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      if (res.flushHeaders) res.flushHeaders();

      const emit = (delta) => {
        if (delta && res.socket && !res.socket.destroyed) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      };

      try {
        const out = await runChatTurnStream({
          messages,
          tools: getToolSchemas(),
          executeTool,
          onDelta: (d) => {
            if (d) {
              streamed += d;
              emit(d);
            }
          },
        });
        provider = out.provider;
        executedTools = out.toolCallsExecuted || [];
        finalReply = out.reply || streamed;
      } catch (llmErr) {
        console.error('Groq stream error:', llmErr.message);
        if (streamed) {
          finalReply = streamed; // tokens already on the wire stand as the reply
        } else {
          try {
            const retry = await runChatTurn({ messages, tools: getToolSchemas(), executeTool });
            finalReply = retry.reply;
            executedTools = retry.toolCallsExecuted;
            provider = retry.provider;
            emit(finalReply);
          } catch (finalErr) {
            console.error('Groq error:', finalErr.message);
            res.write(
              `data: ${JSON.stringify({
                done: true,
                reply: '',
                error: 'AI service temporarily unavailable. Please try again.',
                sessionId,
                actions: [],
                sources: [],
                provider: 'none',
              })}\n\n`
            );
            res.end();
            return;
          }
        }
      }

      res.write(
        `data: ${JSON.stringify({
          done: true,
          reply: finalReply,
          sessionId,
          actions: executedTools,
          sources: contextChunks.map((c) => c.id),
          provider,
        })}\n\n`
      );
      res.end();

      persistTurn({ orgId, sessionId, channel, userMessage: message, assistantMessage: finalReply });
      if (!executedTools.length && finalReply) {
        if (answerCache.size >= ANSWER_CACHE_MAX) answerCache.clear();
        answerCache.set(cacheKey, {
          reply: finalReply,
          actions: [],
          sources: contextChunks.map((c) => c.id),
          provider,
          expires: Date.now() + ANSWER_CACHE_TTL_MS,
          hits: 0,
        });
      }
      return;
    }

    /* ---- JSON path: multi-turn sessions + tool conversations ---- */
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

    // Only pure-KB answers are cached (tool replies may be session-specific).
    if (!result.toolCallsExecuted.length && result.reply) {
      if (answerCache.size >= ANSWER_CACHE_MAX) answerCache.clear();
      answerCache.set(cacheKey, {
        reply: result.reply,
        actions: result.toolCallsExecuted,
        sources: contextChunks.map((c) => c.id),
        provider: result.provider,
        expires: Date.now() + ANSWER_CACHE_TTL_MS,
        hits: 0,
      });
    }

    /*
      Reply first, persist after — persistTurn runs the transcript + usage
      writes in the background once the response is already on the wire.
    */
    res.json({
      reply: result.reply,
      actions: result.toolCallsExecuted,
      sources: contextChunks.map((c) => c.id),
      provider: result.provider,
    });

    persistTurn({ orgId, sessionId, channel, userMessage: message, assistantMessage: result.reply });
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
