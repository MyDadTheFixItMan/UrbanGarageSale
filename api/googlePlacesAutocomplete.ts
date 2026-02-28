import { initializeApp, cert } from 'npm:firebase-admin@12.0.0/app';
import { getAuth } from 'npm:firebase-admin@12.0.0/auth';

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

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
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { input, action, placeId } = body;

    if (!input && action === 'autocomplete') {
      return Response.json({ error: 'Missing input parameter' }, { status: 400 });
    }

    if (action === 'autocomplete') {
      // Call Google Places Autocomplete API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&key=${GOOGLE_PLACES_API_KEY}&components=country:au`
      );

      const data = await response.json();

      return Response.json(data, { status: 200 });
    } else if (action === 'details') {
      if (!placeId) {
        return Response.json({ error: 'Missing placeId parameter' }, { status: 400 });
      }

      // Call Google Places Details API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          placeId
        )}&key=${GOOGLE_PLACES_API_KEY}&fields=formatted_address,geometry,address_components,name`
      );

      const data = await response.json();

      return Response.json(data, { status: 200 });
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Google Places API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
