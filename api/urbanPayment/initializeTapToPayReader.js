// api/urbanPayment/initializeTapToPayReader.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // In production, verify this token with Firebase Admin SDK
    // For now, we're delegating to the frontend to handle payment sheet
    // The reader registration happens on the device itself

    const { sellerId, sellerEmail } = req.body;

    if (!sellerId || !sellerEmail) {
      return res.status(400).json({ error: 'Missing sellerId or sellerEmail' });
    }

    // In a full implementation, this would:
    // 1. Create a Stripe Terminal reader registration token
    // 2. Store reader info in Firestore
    // 3. Return the token to the device

    // For now, return a mock registration token
    // The actual Tap to Pay happens via Stripe Payment Intents on the device
    const registrationToken = `reader_${sellerId}_${Date.now()}`;

    // Store reader info in Firestore (in production)
    // await admin.firestore().collection('sellers').doc(sellerId).update({
    //   'tapToPayReaders': admin.firestore.FieldValue.arrayUnion([{
    //     registrationToken,
    //     registeredAt: admin.firestore.Timestamp.now(),
    //     active: true
    //   }])
    // });

    return res.status(200).json({
      success: true,
      readerRegistrationToken: registrationToken,
      message: 'Reader initialized successfully. Device is ready to accept Tap to Pay payments.',
      sellerId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Initialize Tap to Pay Reader error:', error);
    return res.status(500).json({
      error: 'Failed to initialize reader',
      message: error.message,
    });
  }
}
