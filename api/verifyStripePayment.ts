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

        const { sessionId, saleId } = await req.json();

        if (!sessionId || !saleId) {
            return Response.json({ error: 'Missing required parameters' }, { 
                status: 400,
                headers: setCorsHeaders(req),
            });
        }

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return Response.json({ success: false, error: 'Payment not completed' }, { 
                status: 400,
                headers: setCorsHeaders(req),
            });
        }

        // Create payment record in Firestore
        const db = admin.firestore();
        await db.collection('payments').add({
            garage_sale_id: saleId,
            user_email: user.email,
            user_uid: user.uid,
            amount: 10,
            status: 'completed',
            payment_method: 'stripe',
            transaction_id: session.payment_intent,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update sale status
        await db.collection('garage_sales').doc(saleId).update({
            status: 'pending_approval',
            payment_status: 'paid',
            payment_completed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return Response.json({ success: true }, {
            headers: setCorsHeaders(req),
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        return Response.json({ error: error.message }, { 
            status: 500,
            headers: setCorsHeaders(req),
        });
    }
});