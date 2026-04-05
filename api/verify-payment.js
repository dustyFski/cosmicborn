export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id, birth_day, birth_month, birth_year, sun_sign, life_path_number } = req.body;

  if (!session_id || !session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  if (!birth_day || !birth_month || !birth_year) {
    return res.status(400).json({ error: 'Missing birth data' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Payment configuration error' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  try {
    // Check if session already used
    if (supabaseUrl && supabaseKey) {
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/paid_sessions?stripe_session_id=eq.${encodeURIComponent(session_id)}&select=id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing.length > 0) {
          return res.status(409).json({ error: 'This session has already been used' });
        }
      }
    }

    // Verify Stripe checkout session
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });

    if (!stripeRes.ok) {
      console.error('Stripe API error:', stripeRes.status);
      return res.status(402).json({ error: 'Payment verification failed' });
    }

    const session = await stripeRes.json();

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    // Record paid session in Supabase
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/rest/v1/paid_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          stripe_session_id: session_id,
          email: session.customer_details?.email || null,
          birth_day: parseInt(birth_day),
          birth_month: parseInt(birth_month),
          birth_year: parseInt(birth_year),
          sun_sign: sun_sign || null,
          life_path_number: life_path_number ? parseInt(life_path_number) : null,
          amount_usd: 9.00,
          created_at: new Date().toISOString(),
        }),
      }).catch(err => console.error('Session record error:', err));
    }

    // Generate full report
    const analyzeRes = await fetch(`${getBaseUrl(req)}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: parseInt(birth_day),
        month: parseInt(birth_month),
        year: parseInt(birth_year),
        sun_sign,
        life_path: life_path_number ? parseInt(life_path_number) : null,
        sections: 'full',
      }),
    });

    if (!analyzeRes.ok) {
      const err = await analyzeRes.json();
      return res.status(502).json({ error: err.error || 'Report generation failed' });
    }

    const reportData = await analyzeRes.json();

    return res.status(200).json({
      ...reportData,
      payment_verified: true,
      session_id,
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
