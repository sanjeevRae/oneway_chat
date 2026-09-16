const express = require('express');
const crypto = require('crypto');
const supabaseAdmin = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** GET /api/org/role — current user's role */
router.get('/role', requireAuth, (req, res) => {
  res.json({ role: req.role || 'owner' });
});

/** GET /api/org/me — current org + settings + usage stats */
router.get('/me', requireAuth, async (req, res) => {
  const started = Date.now();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartISO = monthStart.toISOString();

  const config = require('../config');

  // All independent queries run in parallel.
  const timedQuery = async (name, query) => {
    const start = Date.now();
    const result = await query;
    console.log(`[ORG/ME] ${name}: ${Date.now() - start}ms`);
    return result;
  };

  const [
    { data: org },
    { data: settings },
    { count: messages },
    { count: bookings },
    { count: leadsCount },
    { count: docs },
  ] = await Promise.all([
    timedQuery(
      'organizations',
      supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', req.orgId)
        .single()
    ),

    timedQuery(
      'settings',
      supabaseAdmin
        .from('settings')
        .select('*')
        .eq('organization_id', req.orgId)
        .maybeSingle()
    ),

    timedQuery(
      'messages usage',
      supabaseAdmin
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', req.orgId)
        .eq('event_type', 'message')
        .gte('created_at', monthStartISO)
    ),

    timedQuery(
      'bookings usage',
      supabaseAdmin
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', req.orgId)
        .eq('event_type', 'booking')
        .gte('created_at', monthStartISO)
    ),

    timedQuery(
      'leads',
      supabaseAdmin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', req.orgId)
    ),

    timedQuery(
      'documents',
      supabaseAdmin
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', req.orgId)
    ),
  ]);

  const messageQuota =
    org?.monthly_message_quota ?? config.freeTierQuotas.messagesPerMonth;

  console.log(`[ORG/ME] DB queries finished in ${Date.now() - started}ms`);

  res.json({
    org,
    settings,
    role: req.role,
    usage: {
      messagesThisMonth: messages || 0,
      messageQuota,
      bookingsThisMonth: bookings || 0,
      totalLeads: leadsCount || 0,
      documents: docs || 0,
    },
  });
});

/** PATCH /api/org/settings — update bot settings */
router.patch('/settings', requireAuth, async (req, res) => {
  const allowed = ['bot_name', 'welcome_message', 'brand_color', 'notify_email', 'whatsapp_number', 'webhook_url', 'timezone'];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('settings')
    .update(updates)
    .eq('organization_id', req.orgId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ settings: data });
});

/** PATCH /api/org/profile — update org profile */
router.patch('/profile', requireAuth, async (req, res) => {
  const allowed = ['name', 'industry', 'timezone'];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update(updates)
    .eq('id', req.orgId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ org: data });
});

/** POST /api/org/api-key — generate widget API key */
router.post('/api-key', requireAuth, async (req, res) => {
  const rawKey = 'OneWayChat_' + crypto.randomBytes(24).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { error } = await supabaseAdmin
    .from('api_keys')
    .insert({ organization_id: req.orgId, key_hash: keyHash, label: 'widget' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ apiKey: rawKey }); // shown once; only hash stored
});

module.exports = router;

// Export helper for widget route to verify keys
function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
module.exports.hashKey = hashKey;
