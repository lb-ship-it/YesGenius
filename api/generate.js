// soubor: api/generate.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    // Inicializace
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ZDE JE OPRAVA: Používáme základní název. 
    // S knihovnou verze 0.21.0 (kterou máš v package.json) toto MUSÍ fungovat.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    // Generování
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Čištění JSONu
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1) throw new Error("Invalid JSON format from AI");
    
    const cleanJson = text.substring(firstBrace, lastBrace + 1);
    const parsedDrafts = JSON.parse(cleanJson);

    return res.status(200).json(parsedDrafts);

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
}
