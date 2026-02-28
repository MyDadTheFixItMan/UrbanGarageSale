import * as admin from 'npm:firebase-admin@12.0.0';

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
        // Verify authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return Response.json(
                { error: 'Unauthorized' },
                {
                    status: 401,
                    headers: setCorsHeaders(req),
                }
            );
        }

        const token = authHeader.substring(7);
        const auth = initializeFirebase();
        const decodedToken = await auth.verifyIdToken(token);

        // Check if requesting user is admin
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const requestingUser = userDoc.data();

        if (requestingUser?.role !== 'admin') {
            return Response.json(
                { error: 'Only admins can delete users' },
                {
                    status: 403,
                    headers: setCorsHeaders(req),
                }
            );
        }

        // Get the user ID to delete from request body
        const body = await req.json();
        const userIdToDelete = body.userId;

        if (!userIdToDelete) {
            return Response.json(
                { error: 'userId is required' },
                {
                    status: 400,
                    headers: setCorsHeaders(req),
                }
            );
        }

        // Delete the Firebase Auth user
        await auth.deleteUser(userIdToDelete);

        // Delete the Firestore user document
        await db.collection('users').doc(userIdToDelete).delete();

        return Response.json(
            { success: true, message: 'User deleted successfully' },
            {
                status: 200,
                headers: setCorsHeaders(req),
            }
        );
    } catch (error) {
        console.error('Error deleting user:', error);
        return Response.json(
            {
                error: error instanceof Error ? error.message : 'Failed to delete user',
            },
            {
                status: 500,
                headers: setCorsHeaders(req),
            }
        );
    }
});
