export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { day, month, year, sun_sign, sun_element, sun_modality, sun_planet, life_path, moon_sign_approx, personal_year_2026, partner_sign, sections = 'free' } = req.body;

  if (!day || !month || !year) {
    return res.status(400).json({ error: 'Day, month, and year are required' });
  }

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1950 || year > 2010) {
    return res.status(400).json({ error: 'Invalid date values' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API configuration error' });
  }

  const isFree = sections === 'free';
  const isCompat = sections === 'compat';
  const prompt = isCompat
    ? buildCompatPrompt({ sun_sign, sun_element, sun_modality, sun_planet, life_path, partner_sign })
    : buildPrompt({ day, month, year, sun_sign, sun_element, sun_modality, sun_planet, life_path, moon_sign_approx, personal_year_2026, isFree });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isCompat ? 800 : (isFree ? 1200 : 2800),
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'Report generation failed' });
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);
    } catch {
      console.error('JSON parse error, raw:', rawText.substring(0, 500));
      return res.status(502).json({ error: 'Report parse error', debug: rawText.substring(0, 200) });
    }

    return res.status(200).json({
      day,
      month,
      year,
      sun_sign,
      life_path,
      moon_sign_approx,
      personal_year_2026,
      report: parsed,
      is_free: isFree,
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

function buildPrompt({ day, month, year, sun_sign, sun_element, sun_modality, sun_planet, life_path, moon_sign_approx, personal_year_2026, isFree }) {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const birthDate = `${monthNames[month - 1]} ${day}, ${year}`;

  const freeSections = `
    "sun_sign_energy": {
      "headline": "one punchy sentence about this person's solar identity",
      "body": "3-4 sentences about what it means to be a ${sun_sign} born on ${birthDate}. Be specific to the degree — not generic zodiac. Reference the ${sun_element} element and ${sun_modality} modality. Every sentence should feel hauntingly accurate, not like a horoscope column.",
      "element_gift": "one sentence about their elemental gift — what ${sun_element} gives them that other elements lack",
      "shadow": "one sentence about the shadow side of this specific solar placement"
    },
    "life_path_number": {
      "headline": "one punchy sentence about Life Path ${life_path}",
      "body": "3-4 sentences about what Life Path ${life_path} means for someone born on ${birthDate}. Ground it in numerology tradition but make it feel modern and specific. Avoid generic 'you are a natural leader' language.",
      "life_mission": "one sentence distilling their core life mission",
      "power_challenge": "one sentence about the one challenge that will define their growth"
    },
    "love_energy": {
      "headline": "one punchy sentence about how this person loves and receives love",
      "body": "2-3 sentences about the love patterns of a ${sun_sign} with Life Path ${life_path}. How do they show love? What makes them feel seen? What pattern do they keep repeating? Be specific to this combination — not generic zodiac romance.",
      "love_style": "one sentence naming their dominant way of expressing or receiving love",
      "warning": "one sentence about their most consistent relationship blind spot"
    }`;

  const paidSections = `
    "moon_sign_depth": {
      "headline": "one punchy sentence about their emotional inner world",
      "body": "3-4 sentences about what a ${moon_sign_approx} Moon means for someone with a ${sun_sign} Sun. How do they process emotions? What do they need but rarely ask for? This is approximate — note that birth time would refine this.",
      "note": "Birth time unknown — this is an approximate Moon sign based on the date alone. With exact birth time, this reading could shift.",
      "emotional_need": "one sentence about their deepest emotional need",
      "hidden_gift": "one sentence about a gift this Moon placement gives them that most people never see"
    },
    "personal_year_2026": {
      "headline": "one punchy sentence about what 2026 holds for them",
      "body": "3-4 sentences about Personal Year ${personal_year_2026} for this specific person. What themes will dominate? What should they lean into? What will feel harder than expected?",
      "key_theme": "one sentence naming the dominant theme of their 2026",
      "power_window": "one sentence about the specific month or season where their energy peaks in 2026"
    },
    "elemental_blueprint": {
      "headline": "one punchy sentence about their elemental composition",
      "body": "3-4 sentences about how ${sun_element} (Sun) combines with their Moon and Life Path energy. Are they balanced or dominant in one element? What does this mean for how they move through the world?",
      "balance": "one sentence about what element they may need more of",
      "compensation": "one sentence about how they unconsciously compensate for elemental imbalance"
    },
    "cosmic_strengths_shadows": {
      "headline": "one punchy sentence about their cosmic duality",
      "body": "3-4 sentences synthesizing their Sun, Moon, and Life Path into a unified picture of their greatest strength and deepest shadow. This should feel like a mirror — uncomfortably accurate.",
      "top_strength": "one phrase naming their single greatest cosmic strength",
      "core_shadow": "one phrase naming their core shadow pattern",
      "integration_path": "one sentence about how to integrate shadow into strength"
    },
    "cosmic_edge": {
      "headline": "one punchy sentence about their unique advantage right now",
      "body": "3-4 sentences about what makes this specific cosmic combination powerful in 2026. Be optimistic but grounded. What do they have that others genuinely lack?",
      "power_move": "one actionable sentence about the single best move they can make this year"
    }`;

  const sectionContent = isFree ? freeSections : `${freeSections},${paidSections}`;

  return `You are a masterful astrologer and numerologist who speaks with intimate specificity. You combine Western tropical astrology with Pythagorean numerology. Your voice is warm but precise — every line should feel hauntingly accurate, like you are reading someone's soul. No generic zodiac cliches. No "you are a natural leader" filler. Every sentence must feel like it was written for THIS person alone.

Analyze the cosmic blueprint for someone born on ${birthDate}.

Known data:
- Sun sign: ${sun_sign} (${sun_element}, ${sun_modality}, ruled by ${sun_planet})
- Life Path number: ${life_path}
- Approximate Moon sign: ${moon_sign_approx || 'unknown'}
- Personal Year 2026: ${personal_year_2026 || 'unknown'}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  ${sectionContent}
}

Rules:
- Be specific and intimate — this is a one-on-one reading, not a mass horoscope
- Every sentence should feel hauntingly accurate, not generically positive
- Name specific patterns, not vague tendencies
- Headlines should be punchy and surprising, not predictable
- Shadow content is as important as strength content — don't sugarcoat
- Write for someone who wants truth, not flattery`;
}

function buildCompatPrompt({ sun_sign, sun_element, sun_modality, sun_planet, life_path, partner_sign }) {
  return `You are a masterful astrologer who speaks with intimate specificity. Return ONLY valid JSON (no markdown, no explanation).

Analyze the cosmic compatibility between a ${sun_sign} (${sun_element}, ${sun_modality}, Life Path ${life_path}) and a ${partner_sign}.

Return exactly this structure:
{
  "compatibility": {
    "headline": "one punchy sentence naming the essence of this pairing — not generic, surprising",
    "chemistry": "2-3 sentences on what draws them together. The specific irresistible pull between these two signs. Name the actual dynamic.",
    "challenge": "2-3 sentences on the real friction. Where they'll clash, frustrate each other, or talk past each other. Be honest.",
    "verdict": "one punchy sentence — the honest summary of this pairing's potential",
    "secret_weapon": "one sentence on the unexpected strength this combination has that neither sign carries alone"
  }
}

Rules: Specific and intimate. Name real patterns between these signs. Not generic astrology column advice.`;
}
