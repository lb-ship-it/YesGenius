// soubor: api/generate.js

export const config = {
    runtime: 'edge', // Edge pro rychlost
};

export default async function handler(req) {
    // 1. Nastavení CORS
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

        // 2. Prompt (Instrukce pro PRO model)
        const prompt = `You are YES Genius, an expert diplomat.
        Task: Write 3 distinct messages for a user sending a message to their ${recipient}.
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

        // 3. PŘÍMÉ VOLÁNÍ GEMINI 1.5 PRO
        // Toto je aktuální vlajková loď Googlu.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // 4. Debugging
        if (data.error) {
            console.error("Google Pro Error:", data.error);
            return new Response(JSON.stringify({ error: `Google Error: ${data.error.message}` }), { status: 500 });
        }

        // 5. Zpracování
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!candidate) {
            return new Response(JSON.stringify({ error: 'AI returned empty response' }), { status: 500 });
        }

        const firstBrace = candidate.indexOf('{');
        const lastBrace = candidate.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) {
            return new Response(JSON.stringify({ error: 'Invalid JSON from AI' }), { status: 500 });
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
