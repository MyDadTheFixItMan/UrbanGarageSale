import Stripe from 'npm:stripe@17.5.0';
import * as admin from 'npm:firebase-admin@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// Helper function to add CORS headers
const setCorsHeaders = (req: Request) => {
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
};

// Initialize Firebase Admin
const initializeFirebase = () => {
    if (!admin.apps.length) {
        admin.initializeApp({
            projectId: Deno.env.get('FIREBASE_PROJECT_ID'),
        });
    }
    return admin.auth();
};

Deno.serve(async (req) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: setCorsHeaders(req),
        });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return Response.json({ error: 'Unauthorized' }, { 
                status: 401,
                headers: setCorsHeaders(req),
            });
        }

        const token = authHeader.substring(7);
        const auth = initializeFirebase();
        const decodedToken = await auth.verifyIdToken(token);
        const user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { 
                status: 401,
                headers: setCorsHeaders(req),
            });
        }

        const { saleId, saleTitle } = await req.json();

        if (!saleId) {
            return Response.json({ error: 'Sale ID is required' }, { 
                status: 400,
                headers: setCorsHeaders(req),
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
                app_name: 'Urban Garage Sale',
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

        return Response.json({ url: session.url }, {
            headers: setCorsHeaders(req),
        });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return Response.json({ error: error.message }, { 
            status: 500,
            headers: setCorsHeaders(req),
        });
    }
});