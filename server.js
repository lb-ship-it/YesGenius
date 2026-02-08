const fs = require('fs');
const path = require('path');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
    // 1. Nastavení hlaviček (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const fullUrl = `${protocol}://${host}`;

    // 2. API PLATBA (Cena 455 CZK)
    if (req.url.includes('platba') && req.method === 'POST') {
        try {
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

    // 3. API GENEROVÁNÍ (AI Gemini)
    if (req.url.includes('generovat') && req.method === 'POST') {
        let body = '';
        return new Promise((resolve) => {
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                    // Zde můžeš upravit prompt, pokud chceš specifičtější výsledky
                    const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ, originální varianty omluvy. Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}. Odpověz POUZE jako čisté JSON pole stringů (např. ["omluva1", "omluva2"]). Žádný markdown.`;
                    
                    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    const data = await apiResponse.json();
                    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
                    // Čištění odpovědi od případného markdownu
                    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    res.status(200).json({ variants: JSON.parse(text) });
                    resolve();
                } catch (e) {
                    // Fallback v případě chyby AI
                    res.status(200).json({ variants: ["Omlouváme se, AI je přetížena. Zkuste to za chvíli.", "Chyba spojení.", "Zkuste jiný důvod."] });
                    resolve();
                }
            });
        });
    }

    // 4. Obsluha statických souborů (Frontend)
    let urlPath = req.url.split('?')[0];
    let filePath = path.join(process.cwd(), urlPath === '/' ? 'index.html' : urlPath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

    try {
        if (fs.existsSync(filePath) && ext !== '.html' && urlPath !== '/') {
            const content = fs.readFileSync(filePath);
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.status(200).end(content);
        } else {
            // Vše ostatní směruj na index.html (pro Single Page App pocit)
            const indexContent = fs.readFileSync(path.join(process.cwd(), 'index.html'));
            res.setHeader('Content-Type', 'text/html');
            res.status(200).end(indexContent);
        }
    } catch (e) {
        res.status(404).end("Not Found");
    }
};
