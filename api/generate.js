// soubor: api/generate.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server Config Error: API Key missing' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ZDE JE KLÍČOVÁ ZMĚNA:
    // Použijeme 'gemini-1.5-flash-latest', což s novou knihovnou (0.21.0) funguje perfektně.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const { topic, recipient, tone, language } = req.body;

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
        return res.status(500).json({ error: 'AI Error: Invalid JSON format.' });
    }

    const cleanJson = text.substring(firstBrace, lastBrace + 1);
    const parsedDrafts = JSON.parse(cleanJson);

    return res.status(200).json(parsedDrafts);

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: `Backend Error: ${error.message}` });
  }
}
