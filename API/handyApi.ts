import { initializeApp, cert } from 'npm:firebase-admin@12.0.0/app';
import { getAuth } from 'npm:firebase-admin@12.0.0/auth';

const HANDYAPI_BASE_URL = 'https://handyapi.com/api';

// Helper function to add CORS headers
const setCorsHeaders = (req: Request) => {
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
};

// Initialize Firebase Admin SDK
let firebaseApp: any;
try {
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
    
    if (projectId && privateKey && clientEmail) {
        firebaseApp = initializeApp({
            credential: cert({
                projectId,
                privateKey,
                clientEmail,
            }),
        });
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Helper to get user from Firebase ID token
const getUserFromRequest = async (req: Request) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return null;
        }
        
        const idToken = authHeader.substring(7);
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('Auth error:', error);
        return null;
    }
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
        const user = await getUserFromRequest(req);

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { 
                status: 401,
                headers: setCorsHeaders(req),
            });
        }

        const { action, searchText, suburb, postcode, address } = await req.json();
        const apiKey = Deno.env.get('HandyAPI');

        if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { 
                status: 500,
                headers: setCorsHeaders(req),
            });
        }

        // Autocomplete endpoint
        if (action === 'autocomplete' && searchText) {
            const response = await fetch(
                `${HANDYAPI_BASE_URL}/Suburb/Search?Query=${encodeURIComponent(searchText)}`,
                {
                    headers: {
                        'x-api-key': apiKey,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HandyAPI error: ${response.status}`);
            }

            const data = await response.json();
            return Response.json(data, {
                headers: setCorsHeaders(req),
            });
        }

        // Validate suburb and postcode
        if (action === 'validate' && suburb && postcode) {
            const response = await fetch(
                `${HANDYAPI_BASE_URL}/Suburb/Validate`,
                {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ suburb, postcode }),
                }
            );

            if (!response.ok) {
                throw new Error(`HandyAPI error: ${response.status}`);
            }

            const data = await response.json();
            return Response.json(data, {
                headers: setCorsHeaders(req),
            });
        }

        // Geocode endpoint
        if (action === 'geocode' && address) {
            const response = await fetch(
                `${HANDYAPI_BASE_URL}/Geocoding/Address?Address=${encodeURIComponent(address)}`,
                {
                    headers: {
                        'x-api-key': apiKey,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HandyAPI error: ${response.status}`);
            }

            const data = await response.json();
            return Response.json(data, {
                headers: setCorsHeaders(req),
            });
        }

        return Response.json({ error: 'Invalid action or missing parameters' }, { 
            status: 400,
            headers: setCorsHeaders(req),
        });
    } catch (error) {
        return Response.json({ error: error.message }, { 
            status: 500,
            headers: setCorsHeaders(req),
        });
    }
});