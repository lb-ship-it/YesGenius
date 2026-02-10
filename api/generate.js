// soubor: api/generate.js

export default async function handler(req, res) {
    // 1. Nastavení CORS (stejné jako v tvém server.js)
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
            return res.status(500).json({ error: 'Server Error: API Key missing' });
        }

        // Přijímáme data z nového frontendu (topic, recipient, atd.)
        const { topic, recipient, tone, language } = req.body;

        // 2. Prompt (Strukturovaný pro nový design)
        const prompt = `You are YES Genius.
        Task: Write 3 distinct messages for a user sending a message to their ${recipient}.
        Topic: ${topic}.
        Language: ${language}.
        Tone: ${tone}.
        
        CRITICAL: Return ONLY a raw JSON object. No markdown. No intro.
        Structure:
        {
            "option1": "Text of variant 1",
            "option2": "Text of variant 2",
            "option3": "Text of variant 3"
        }`;

        // 3. VOLÁNÍ GOOGLE API (Přesně podle tvého server.js)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Google Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        // 4. ZPRACOVÁNÍ A ČIŠTĚNÍ (Logika z tvého server.js)
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(500).json({ error: 'AI returned empty response' });
        }

        // Čistící logika z tvého souboru (odstranění ```json a ```)
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Najdeme JSON uvnitř (pro jistotu, kdyby tam byl nějaký balast okolo)
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            text = text.substring(firstBrace, lastBrace + 1);
        }

        // Parsování
        let parsedData;
        try {
            parsedData = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }
        
        return res.status(200).json(parsedData);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
