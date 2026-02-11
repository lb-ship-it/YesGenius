const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    // 2. API GENEROVÁNÍ (AI Gemini)
    if (req.url.includes('generovat') && req.method === 'POST') {
        let body = '';
        return new Promise((resolve) => {
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { format, adresat, kategorie, styl, jazyk } = JSON.parse(body);
                    
                    // ZMĚNA: Prompt je nyní v angličtině pro lepší univerzálnost
                    const prompt = `
                    Role: You are "Excuse Genius", a digital diplomat.
                    Task: Generate 3 DISTINCT, believable, and slightly creative excuses/messages.
                    
                    Context:
                    - Target Audience (Recipient): ${adresat}
                    - Reason/Situation: ${kategorie}
                    - Tone/Style: ${styl}
                    - Format: ${format}
                    
                    STRICT RULES:
                    1. OUTPUT LANGUAGE: MUST BE IN ${jazyk}. (If ${jazyk} is Japanese, write in Japanese. If Czech, write in Czech).
                    2. Output Format: Provide ONLY a raw JSON array of strings. No markdown, no code blocks.
                    3. Example format: ["Excuse 1", "Excuse 2", "Excuse 3"]
                    `;
                    
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
                    res.status(500).json({ error: "AI Error: " + e.message });
                    resolve();
                }
            });
        });
    }

    // 3. API PLATBA
    if (req.url.includes('platba') && req.method === 'POST') {
        // ... (Zbytek kódu pro platbu zůstává stejný)
        // ... (Zkopíruj si zbytek původního server.js pokud tam máš něco navíc, ale pro AI stačí změnit tu část nahoře)
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: { currency: 'usd', product_data: { name: 'YES Genius License' }, unit_amount: 7900 }, 
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

    res.status(200).json({ status: "Ready" });
};
