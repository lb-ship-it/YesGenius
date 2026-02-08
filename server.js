const fs = require('fs');
const path = require('path');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
    // 1. CORS a hlavičky
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const fullUrl = `${protocol}://${host}`;

    // 2. API TRASY (Musí být před statickými soubory)
    if (req.url.startsWith('/platba') && req.method === 'POST') {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: { currency: 'czk', product_data: { name: 'YES Genius License 👑' }, unit_amount: 19900 },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${fullUrl}/?status=success`,
                cancel_url: `${fullUrl}/?status=canceled`,
            });
            res.status(200).json({ url: session.url });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    if (req.url.startsWith('/generovat') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy. Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}. Odpověz POUZE jako JSON pole stringů.`;
                
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                const data = await apiResponse.json();
                let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
                text = text.replace(/```json/g, "").replace(/```/g, "").trim();
                res.status(200).json({ variants: JSON.parse(text) });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        return;
    }

    // 3. OBSLUHA STATICKÝCH SOUBORŮ
    let urlPath = req.url.split('?')[0];
    let filePath = path.join(process.cwd(), urlPath === '/' ? 'index.html' : urlPath);
    
    // Kontrola přípony pro Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath);
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.status(200).end(content);
        } else {
            // Pokud soubor neexistuje, pošli index.html (pro Single Page Apps)
            const indexContent = fs.readFileSync(path.join(process.cwd(), 'index.html'));
            res.setHeader('Content-Type', 'text/html');
            res.status(200).end(indexContent);
        }
    } catch (e) {
        res.status(404).end("File not found");
    }
};
