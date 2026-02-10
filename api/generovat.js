export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    // 1. CORS
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
        if (!apiKey) return new Response(JSON.stringify({ error: 'Chybí API klíč na serveru' }), { status: 500 });

        const { jazyk, format, adresat, kategorie, styl } = await req.json();

        // Prompt
        const prompt = `Jsi YES Genius.
        Úkol: Napiš 3 varianty zprávy.
        Jazyk: ${jazyk}. Formát: ${format}. Komu: ${adresat}. Situace: ${kategorie}. Styl: ${styl}.
        
        CRITICAL: Return ONLY a raw JSON array of strings. No markdown.
        Example: ["Text 1", "Text 2", "Text 3"]`;

        // 2. VOLÁNÍ MODELU PRO AI STUDIO KLÍČE
        // Používáme v1beta a gemini-1.5-flash. Toto je defaultní model pro nové klíče.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (data.error) {
            // Pokud to selže, vrátíme přesnou chybu, ať víme, co se děje
            console.error("Google Error:", data.error);
            return new Response(JSON.stringify({ error: `Google Error: ${data.error.message}` }), { status: 500 });
        }

        // 3. Zpracování
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return new Response(JSON.stringify({ error: 'AI nic nevygenerovala' }), { status: 500 });

        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // Extrakce JSONu
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        let variants = [];

        if (firstBracket !== -1 && lastBracket !== -1) {
            try {
                variants = JSON.parse(text.substring(firstBracket, lastBracket + 1));
            } catch (e) { variants = [text]; }
        } else {
            variants = [text];
        }

        return new Response(JSON.stringify({ variants }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
