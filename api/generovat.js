export default async function handler(req, res) {
    // 1. Nastavení CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("Chybí GEMINI_API_KEY");

        const { format, adresat, kategorie, styl, jazyk } = req.body;

        const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy/zprávy.
        Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}.
        
        DŮLEŽITÉ: Odpověz POUZE čistým JSON polem stringů. Žádný markdown.
        Příklad: ["Text 1", "Text 2", "Text 3"]`;

        // --- ZMĚNA ZDE ---
        // Přešli jsme z "v1beta" na stabilní "v1", kde model Flash bezpečně bydlí.
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await apiResponse.json();

        if (data.error) {
            console.error("Google Error:", data.error);
            // Detailní výpis chyby, kdyby se náhodou něco pokazilo
            return res.status(500).json({ error: `Google API Error: ${data.error.message}` });
        }

        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // Pojistka pro extrakci JSONu
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            text = text.substring(firstBracket, lastBracket + 1);
        }

        let variants = [];
        try { 
            variants = JSON.parse(text); 
        } catch (e) { 
            variants = [text]; // Fallback: vrátí surový text, když selže JSON
        }

        return res.status(200).json({ variants });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
