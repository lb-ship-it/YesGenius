// soubor: api/generate.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  // 1. CORS (Standardní hlavičky pro prohlížeč)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Kontrola klíče
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API Key missing on server.");
      return res.status(500).json({ error: 'Server Config Error: API Key missing' });
    }

    // 3. Inicializace Google AI (Oficiální cesta)
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Zde definujeme model. 'gemini-1.5-flash' je standardní alias v SDK.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const { topic, recipient, tone, language } = req.body;

    // 4. Prompt
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

    // 5. Generování obsahu přes SDK
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 6. Čištění JSONu (Pro jistotu)
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
        console.error("AI Output:", text);
        return res.status(500).json({ error: 'AI Error: Invalid JSON format.' });
    }

    const cleanJson = text.substring(firstBrace, lastBrace + 1);
    const parsedDrafts = JSON.parse(cleanJson);

    return res.status(200).json(parsedDrafts);

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: `Backend Error: ${error.message}` });
  }
}
