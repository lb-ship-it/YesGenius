// soubor: api/generate.js
export default async function handler(req, res) {
  // 1. Ověření, že jde o POST požadavek
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Načtení klíče z bezpečného úložiště Vercelu
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API Key configuration' });
  }

  const { topic, recipient, tone, language } = req.body;

  try {
    // 3. Příprava promptu pro Gemini
    const prompt = `You are an expert communication assistant called YES Genius. 
    Task: Write 3 distinct messages for a user sending a message to their ${recipient}.
    Topic: ${topic}.
    Language: ${language} (Ensure the output is in this language).
    Primary Tone: ${tone}.
    
    Output requirements:
    Return ONLY a valid JSON object. Do not include markdown code blocks (\`\`\`json).
    The JSON must have this exact structure:
    {
        "option1": "Text for option 1 (Professional/Standard)",
        "option2": "Text for option 2 (Short/Concise)",
        "option3": "Text for option 3 (More Human/Empathetic or slightly different tone)"
    }`;

    // 4. Volání Google Gemini API (Server-to-Server)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // 5. Zpracování odpovědi
    const rawText = data.candidates[0].content.parts[0].text;
    const jsonString = rawText.replace(/```json|```/g, '').trim(); // Čištění markdownu
    const drafts = JSON.parse(jsonString);

    // 6. Odeslání výsledku zpět do aplikace
    return res.status(200).json(drafts);

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: 'Failed to generate text. Please try again.' });
  }
}
