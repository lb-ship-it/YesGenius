const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (!process.env.STRIPE_SECRET_KEY) throw new Error("Chybí Stripe klíč");

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        
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
            success_url: `${protocol}://${host}/?status=success`,
            cancel_url: `${protocol}://${host}/?status=canceled`,
        });

        return res.status(200).json({ url: session.url });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
