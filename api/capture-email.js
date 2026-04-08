export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, birth_day, birth_month, birth_year, sun_sign, life_path_number } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/email_captures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          email,
          birth_day: birth_day || null,
          birth_month: birth_month || null,
          birth_year: birth_year || null,
          sun_sign: sun_sign || null,
          life_path_number: life_path_number || null,
          source: 'sacredchart_free_report',
          created_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Supabase capture error:', err);
    }
  }

  return res.status(200).json({ ok: true });
}
