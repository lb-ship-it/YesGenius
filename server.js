const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    // 1. API GENEROVÁNÍ (AI Gemini)
    if (req.url.includes('generovat') && req.method === 'POST') {
        try {
            // OPRAVA V5.3: Vercel automaticky parsuje JSON. Pokud ne, načteme ho ručně.
            let payload = req.body;
            if (!payload) {
                const rawBody = await new Promise((resolve) => {
                    let body = '';
                    req.on('data', chunk => body += chunk);
                    req.on('end', () => resolve(body));
                });
                payload = JSON.parse(rawBody);
            } else if (typeof payload === 'string') {
                payload = JSON.parse(payload);
            }

            const { format, adresat, kategorie, styl, jazyk } = payload;
            
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
            
            const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!apiResponse.ok) {
                throw new Error(`Gemini API Error: ${apiResponse.status}`);
            }

            const data = await apiResponse.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            text = text.replace(/```json/gi, "").replace(/```/g, "").trim(); 
            
            res.status(200).json({ variants: JSON.parse(text) });
        } catch (e) {
            console.error("Server Error:", e);
            res.status(500).json({ error: "AI Error: " + e.message });
        }
        return;
    }

    // 2. API PLATBA ($9.99)
    if (req.url.includes('platba') && req.method === 'POST') {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: { 
                        currency: 'usd', 
                        product_data: { name: 'YES Genius Lifetime License', description: 'Unlimited access to Digital Diplomat v5.3' }, 
                        unit_amount: 999 
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

    res.status(200).json({ status: "YES Genius v5.3 API Ready" });
};
