import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId, saleId } = await req.json();

        if (!sessionId || !saleId) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return Response.json({ success: false, error: 'Payment not completed' }, { status: 400 });
        }

        // Create payment record
        await base44.asServiceRole.entities.Payment.create({
            garage_sale_id: saleId,
            user_email: user.email,
            amount: 10,
            status: 'completed',
            payment_method: 'stripe',
            transaction_id: session.payment_intent,
        });

        // Update sale status
        await base44.asServiceRole.entities.GarageSale.update(saleId, {
            status: 'pending_approval',
            payment_status: 'paid',
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Payment verification error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});