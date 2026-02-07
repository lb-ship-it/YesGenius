require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Hlavní funkce (Handler)
const handler = async (req, res) => {
    // 1. Hlavičky (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 2. Získání URL (pro Stripe)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const fullUrl = `${protocol}://${host}`;

    // 3. Cesta k souboru (Vercel vs Local)
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : decodeURI(req.url.split('?')[0]));
    let extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpeg'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        case '.css': contentType = 'text/css'; break;
        case '.js': contentType = 'text/javascript'; break;
    }

    // 4. API: PLATBA
    if (req.url === '/platba' && req.method === 'POST') {
        try {
            if (!stripe) throw new Error("Chybí Stripe klíč");
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'czk',
                        product_data: { name: 'YES Genius - Lifetime License 👑' },
                        unit_amount: 19900, 
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${fullUrl}/?status=success`,
                cancel_url: `${fullUrl}/?status=canceled`,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ url: session.url }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // 5. API: GENEROVÁNÍ
    if (req.url === '/generovat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                if (!process.env.GEMINI_API_KEY) throw new Error("Chybí API Key");
                const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                
                const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy. Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}. Odpověz POUZE jako JSON pole stringů.`;

                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                const data = await apiResponse.json();
                let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
                text = text.replace(/```json/g, "").replace(/```/g, "").trim();
                let variants = [];
                try { variants = JSON.parse(text); } catch { variants = [text]; }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ variants }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // 6. Statické soubory
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
                    if (err2) { res.writeHead(404); res.end("404"); }
                    else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(content2); }
                });
            } else { res.writeHead(500); res.end(`Error: ${err.code}`); }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
};

module.exports = handler;

// Spuštění lokálně
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    http.createServer(handler).listen(PORT, () => {
        console.log(`🚀 Běží na http://localhost:${PORT}`);
    });
}
