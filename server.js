const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
    // 1. Hlavičky (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    // 2. API GENEROVÁNÍ (AI)
    if (req.url.includes('generovat') && req.method === 'POST') {
        let body = '';
        return new Promise((resolve) => {
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                    const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ, uvěřitelné varianty omluvy. Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}. Odpověz POUZE jako JSON pole stringů. Nepoužívej markdown.`;
                    
                    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    const data = await apiResponse.json();
                    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
                    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    res.status(200).json({ variants: JSON.parse(text) });
                    resolve();
                } catch (e) {
                    res.status(500).json({ error: e.message });
                    resolve();
                }
            });
        });
    }

    // 3. API PLATBA (Záloha pro Stripe)
    if (req.url.includes('platba') && req.method === 'POST') {
        try {
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const fullUrl = `${protocol}://${req.headers.host}`;
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: { currency: 'czk', product_data: { name: 'YES Genius License 👑' }, unit_amount: 45500 },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${fullUrl}/?status=success`,
                cancel_url: `${fullUrl}/?status=canceled`,
            });
            return res.status(200).json({ url: session.url });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // Pokud nic nesedí
    res.status(200).json({ status: "Server běží. Pro web jděte na domovskou stránku." });
};
