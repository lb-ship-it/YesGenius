const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.STRIPE_SECRET_KEY) throw new Error("Chybí STRIPE_SECRET_KEY");

        // Zjištění URL odkud uživatel přišel
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const origin = `${protocol}://${host}`;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'czk',
                    product_data: { name: 'YES Genius - Lifetime License 👑' },
                    unit_amount: 19900, // 199 CZK
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${origin}/?status=success`,
            cancel_url: `${origin}/?status=canceled`,
        });

        return res.status(200).json({ url: session.url });

    } catch (e) {
        console.error("Stripe Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
