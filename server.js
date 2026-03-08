const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
    // Nastavení CORS hlaviček pro komunikaci s frontendem
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Ošetření pre-flight requestů
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    // --- 1. API PRO GENEROVÁNÍ ZPRÁV (AI Gemini) ---
    if (req.url.includes('generovat') && req.method === 'POST') {
        let body = '';
        return new Promise((resolve) => {
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                    
                    // V5.2: Vylepšený prompt s kritickými instrukcemi pro asertivitu a Stalkera
                    const prompt = `
                    Role: You are "YES Genius", a high-level digital diplomat and boundary setter.
                    Task: Generate 3 DISTINCT, believable, and situation-appropriate messages.
                    
                    Context:
                    - Target Audience (Recipient): ${adresat}
                    - Reason/Situation: ${kategorie}
                    - Tone/Style: ${styl}
                    - Format: ${format}
                    
                    CRITICAL INSTRUCTION FOR "STALKER" OR ASSERTIVE TONES:
                    If the recipient is a "Stalker", "Harasser", "Obsessive person" or the style requires a "Legal Warning", "Firm", "Assertive", or "Cold" tone: DO NOT apologize under any circumstances. Be extremely firm, clear, uncompromising, and set hard boundaries. Do not leave any room for further discussion.
                    
                    STRICT RULES:
                    1. OUTPUT LANGUAGE: MUST BE IN ${jazyk}. (If ${jazyk} is Japanese, write in Japanese. If Czech, write in Czech, etc.).
                    2. Output Format: Provide ONLY a raw JSON array of strings. No markdown, no HTML formatting, no introductory text.
                    3. Example format: ["Variant 1", "Variant 2", "Variant 3"]
                    `;
                    
                    // Volání Gemini API - Používáme rychlý a spolehlivý model
                    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    const data = await apiResponse.json();
                    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
                    
                    // Bezpečné čištění odpovědi od případných Markdown bloků
                    text = text.replace(/```json/gi, "").replace(/```/g, "").trim(); 
                    
                    res.status(200).json({ variants: JSON.parse(text) });
                    resolve();
                } catch (e) {
                    res.status(500).json({ error: "AI Error: " + e.message });
                    resolve();
                }
            });
        });
    }

    // --- 2. API PRO PLATBU (Stripe) ---
    if (req.url.includes('platba') && req.method === 'POST') {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: { 
                        currency: 'usd', 
                        product_data: { 
                            name: 'YES Genius Lifetime License',
                            description: 'Unlimited access to Digital Diplomat v5.2'
                        }, 
                        unit_amount: 999 // V5.2: Opraveno zpět na 9.99 USD (999 centů)
                    }, 
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `https://yes-genius.vercel.app/?status=success`,
                cancel_url: `https://yes-genius.vercel.app/?status=canceled`,
            });
            return res.status(200).json({ url: session.url });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // Defaultní odpověď pro ověření stavu API
    res.status(200).json({ status: "YES Genius v5.2 API Ready" });
