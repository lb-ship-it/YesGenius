// soubor: api/generate.js

export default async function handler(req, res) {
  // 1. Nastavení CORS (aby to fungovalo z prohlížeče)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Rychlá odpověď na OPTIONS (pre-flight check)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Povolit jen POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Načtení klíče
    const apiKey = process.env.GEMINI_API_KEY;

    // DEBUG: Pokud klíč chybí, backend to teď jasně řekne
    if (!apiKey) {
      console.error("CRITICAL ERROR: GEMINI_API_KEY is missing in Vercel env vars.");
      return res.status(500).json({ error: 'Server Config Error: API Key missing' });
    }

    const { topic, recipient, tone, language } = req.body;

    // 3. Prompt
    const prompt = `You are YES Genius.
    Task: Write 3 messages for a user sending a message to their ${recipient}.
    Topic: ${topic}.
    Language: ${language}.
    Tone: ${tone}.
    
    CRITICAL: Return ONLY a raw JSON object. No markdown. No intro.
    Structure:
    {
        "option1": "Text 1",
        "option2": "Text 2",
        "option3": "Text 3"
    }`;

    // 4. Volání Google API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    // Zachycení chyby přímo od Googlu
    if (data.error) {
      console.error("Google API Error:", JSON.stringify(data.error));
      return res.status(500).json({ error: `Google Error: ${data.error.message}` });
    }

    // 5. Čištění JSONu
    const rawText = data.candidates[0].content.parts[0].text;
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: 'AI Error: Invalid JSON format received.' });
    }

    const cleanJson = rawText.substring(firstBrace, lastBrace + 1);
    const parsedDrafts = JSON.parse(cleanJson);

    // 6. Úspěch!
    return res.status(200).json(parsedDrafts);

  } catch (error) {
    console.error("Server Internal Error:", error);
    return res.status(500).json({ error: `Server Error: ${error.message}` });
  }
}
