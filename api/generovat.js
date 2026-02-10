export default async function handler(req, res) {
    // 1. Nastavení CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Chybí GEMINI_API_KEY");

        const { format, adresat, kategorie, styl, jazyk } = req.body;

        // 2. Prompt (stejný jako v tvém server.js)
        const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy.
        Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}.
        Odpověz POUZE jako JSON pole stringů.`;

        // 3. VOLÁNÍ API - OPRAVENO NA gemini-1.5-flash (v1beta)
        // Toto je verze, která funguje s většinou klíčů.
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await apiResponse.json();

        if (data.error) {
            console.error("Google Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        // 4. Zpracování (stejné jako v tvém server.js)
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        let variants = [];
        try { 
            // Najdeme začátek a konec JSON pole pro jistotu
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                text = text.substring(start, end + 1);
            }
            variants = JSON.parse(text); 
        } catch (e) { 
            variants = [text]; 
        }

        return res.status(200).json({ variants });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
