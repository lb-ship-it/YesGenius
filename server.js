require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

// Načtení Stripe (pokud je klíč v .env)
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Statické soubory
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

    // --- 1. API: PLATBA (STRIPE) ---
    if (req.url === '/platba' && req.method === 'POST') {
        try {
            if (!stripe) throw new Error("Stripe klíč chybí v .env");

            // Vytvoření platební brány
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'czk',
                        product_data: { name: 'YES Genius - Lifetime License 👑' }, // Název produktu
                        unit_amount: 19900, // Cena v haléřích (199.00 CZK)
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                // Tady je ten trik: použijeme adresu, ze které uživatel přišel (PC nebo mobil)
                success_url: `http://${req.headers.host}/?status=success`,
                cancel_url: `http://${req.headers.host}/?status=canceled`,
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ url: session.url }));
        } catch (e) {
            console.error("Chyba platby:", e.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // --- 2. API: GENEROVÁNÍ (AI) ---
    if (req.url === '/generovat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                if (!process.env.GEMINI_API_KEY) throw new Error("Chybí GEMINI_API_KEY");
                
                const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                console.log(`🤖 Generuji (${jazyk}): ${kategorie}`);

                const prompt = `Jsi "Excuse Genius". Vymysli 3 RŮZNÉ varianty omluvy.
                Jazyk: ${jazyk}. Typ: ${format}. Komu: ${adresat}. Důvod: ${kategorie}. Styl: ${styl}.
                Odpověz POUZE jako JSON pole stringů.`;

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

    // --- 3. STATICKÉ SOUBORY ---
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
});

server.listen(PORT, () => {
    console.log(`\n🚀 YES GENIUS BĚŽÍ! http://localhost:${PORT}`);
});