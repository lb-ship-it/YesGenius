// soubor: api/generate.js
export default async function handler(req, res) {
  // 1. CORS hlavičky (aby to fungovalo odkudkoli)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Kontrola API klíče
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CHYBA: Chybí GEMINI_API_KEY ve Vercel Environment Variables.");
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

  const { topic, recipient, tone, language } = req.body;

  try {
    // 3. Prompt (Instrukce pro AI)
    const prompt = `You are an expert communication assistant called YES Genius. 
    Task: Write 3 distinct messages for a user sending a message to their ${recipient}.
    Topic: ${topic}.
    Language: ${language} (Ensure the output is strictly in this language).
    Primary Tone: ${tone}.
    
    IMPORTANT: You must return ONLY a raw JSON object. Do not use markdown code blocks. Do not add any introductory text.
    The JSON structure must be exactly:
    {
        "option1": "Text for option 1 (Professional/Standard)",
        "option2": "Text for option 2 (Short/Concise)",
        "option3": "Text for option 3 (More Human/Empathetic or slightly different tone)"
    }`;

    // 4. Volání Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    // Logování chyby z Google API pro lepší debug
    if (data.error) {
      console.error("Gemini API Error Detail:", JSON.stringify(data.error, null, 2));
      throw new Error(data.error.message || 'Error from Google API');
    }

    // 5. Zpracování a čištění odpovědi (The Fix for 'undefined')
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Najdeme první '{' a poslední '}'
    const jsonStartIndex = rawText.indexOf('{');
    const jsonEndIndex = rawText.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error("AI returned invalid JSON format");
    }

    const cleanJsonString = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
    const drafts = JSON.parse(cleanJsonString);

    // 6. Odeslání výsledku
    return res.status(200).json(drafts);

  } catch (error) {
    console.error("Server Error Log:", error);
    return res.status(500).json({ error: error.message || 'Failed to generate text.' });
  }
}
