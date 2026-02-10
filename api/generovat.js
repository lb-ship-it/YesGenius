export default async function handler(req, res) {
    // CORS (Povolení přístupu)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("Chybí GEMINI_API_KEY");

        // Data z tvého index.html
        const { format, adresat, kategorie, styl, jazyk } = req.body;

        // Prompt
        const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy/zprávy.
        Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}.
        
        DŮLEŽITÉ: Odpověz POUZE čistým JSON polem stringů. Žádný markdown, žádné "json" na začátku.
        Příklad výstupu: ["Text 1", "Text 2", "Text 3"]`;

        // VOLÁNÍ API - OPRAVENO NA EXISTUJÍCÍ MODEL gemini-1.5-flash
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await apiResponse.json();

        // Kontrola chyb od Googlu
        if (data.error) {
            console.error("Google Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        // Zpracování textu
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        
        // Čištění bordelu (markdownu)
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // Extrakce JSONu (pokud tam je balast okolo)
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            text = text.substring(firstBracket, lastBracket + 1);
        }

        let variants = [];
        try { 
            variants = JSON.parse(text); 
        } catch (e) { 
            console.error("Chyba parsování:", text);
            variants = [text]; // Fallback, vrátí aspoň surový text
        }

        return res.status(200).json({ variants });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
