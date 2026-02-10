// Poznámka: Žádný 'runtime: edge'. Používáme standardní Node.js pro maximální kompatibilitu.

export default async function handler(req, res) {
    // 1. CORS (Aby frontend mohl komunikovat s backendem)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Rychlá odpověď pro prohlížeč
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Čištění klíče od případných mezer
        const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
        
        if (!apiKey) {
            console.error("Chybí API klíč");
            return res.status(500).json({ error: 'Server Error: Chybí API klíč.' });
        }

        // Data z frontendu
        const { jazyk, format, adresat, kategorie, styl } = req.body;

        // Prompt (přesně podle tvého server.js)
        const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy/zprávy.
        Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}.
        
        DŮLEŽITÉ: Odpověz POUZE čistým JSON polem stringů. Žádný markdown.
        Příklad výstupu: ["Text 1", "Text 2", "Text 3"]`;

        // 2. VOLÁNÍ GOOGLE API
        // Používáme 'gemini-1.5-flash' (v1beta). Toto je jediná správná kombinace.
        // Tvůj server.js měl '2.5-flash', což neexistuje.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // Debugging chyb přímo od Googlu
        if (data.error) {
            console.error("Google API Error:", JSON.stringify(data.error));
            // Pokud Google vrátí 404, znamená to problém s klíčem/projektem, ne s kódem
            return res.status(500).json({ error: `Google Error: ${data.error.message}` });
        }

        // 3. Zpracování odpovědi (logika z tvého server.js)
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            return res.status(500).json({ error: 'AI nevrátila žádný text.' });
        }

        // Odstranění markdownu ```json ... ```
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Najdeme hranaté závorky []
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        
        let variants = [];
        if (firstBracket !== -1 && lastBracket !== -1) {
            try {
                // Vyřízneme jen to pole
                const jsonStr = text.substring(firstBracket, lastBracket + 1);
                variants = JSON.parse(jsonStr);
            } catch (e) {
                // Fallback
                variants = [text];
            }
        } else {
            variants = [text];
        }

        return res.status(200).json({ variants });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
