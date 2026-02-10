// soubor: api/generate.js
export const config = {
    runtime: 'edge', // Používáme Edge pro maximální rychlost a jednoduchost
};

export default async function handler(req) {
    // 1. CORS (Aby to fungovalo z prohlížeče)
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 500 });
        }

        const { topic, recipient, tone, language } = await req.json();

        // 2. Prompt
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

        // 3. PŘÍMÉ VOLÁNÍ (Model: gemini-pro)
        // Toto je ten rozdíl. Voláme starší, ale 100% stabilní model.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // 4. Debugging chyb
        if (data.error) {
            return new Response(JSON.stringify({ error: `Google Error: ${data.error.message}` }), { status: 500 });
        }

        // 5. Čištění odpovědi
        // Gemini Pro občas vrací text trochu jinak, musíme být opatrní
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!candidate) {
            return new Response(JSON.stringify({ error: 'AI returned empty response' }), { status: 500 });
        }

        const firstBrace = candidate.indexOf('{');
        const lastBrace = candidate.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) {
             // Fallback kdyby nevrátil JSON
            return new Response(JSON.stringify({ 
                option1: candidate, 
                option2: "Could not parse options", 
                option3: "Could not parse options" 
            }), { status: 200 });
        }
        
        const cleanJson = candidate.substring(firstBrace, lastBrace + 1);
        
        return new Response(cleanJson, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
