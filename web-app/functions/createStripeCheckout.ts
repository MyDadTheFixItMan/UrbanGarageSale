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

        const { saleId, saleTitle } = await req.json();

        if (!saleId) {
            return new Response(JSON.stringify({ error: 'Sale ID is required' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price: 'price_1SsiIg7hRwXmBUxS1Mif9tKP',
                    quantity: 1,
                },
            ],
            customer_email: user.email,
            success_url: `${req.headers.get('origin')}/Payment?id=${saleId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin')}/CreateListing?edit=${saleId}`,
            metadata: {
                base44_app_id: Deno.env.get('BASE44_APP_ID'),
                sale_id: saleId,
                user_email: user.email,
            },
            payment_intent_data: {
                metadata: {
                    sale_id: saleId,
                    sale_title: saleTitle || 'Garage Sale Listing',
                },
            },
        });

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: corsHeaders,
        });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
});