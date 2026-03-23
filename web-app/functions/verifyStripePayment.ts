import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        const { sessionId, saleId } = await req.json();

        if (!sessionId || !saleId) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return new Response(
                JSON.stringify({ success: false, error: 'Payment not completed' }),
                {
                    status: 400,
                    headers: corsHeaders,
                }
            );
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

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: corsHeaders,
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
});