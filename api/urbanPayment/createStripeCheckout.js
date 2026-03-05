// Create Stripe Checkout session for listing purchases
// This returns a URL to redirect the user to Stripe Checkout

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
const isDevelopment = !stripeSecretKey || stripeSecretKey.includes('YOUR_STRIPE_SECRET_KEY');

console.log('📌 createStripeCheckout module loaded');
console.log('   Stripe configured:', stripeSecretKey && !isDevelopment);
console.log('   Development mode:', isDevelopment);

// Lazy load Stripe
let stripeInstance = null;

async function initStripe() {
  if (!stripeInstance) {
    try {
      const Stripe = (await import('stripe')).default;
      if (!stripeSecretKey || isDevelopment) {
        console.warn('⚠️  STRIPE_SECRET_KEY not set - using development/mock mode');
        return null;
      }
      stripeInstance = new Stripe(stripeSecretKey);
      console.log('✅ Stripe client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Stripe:', error.message);
      if (!isDevelopment) {
        throw error;
      }
      return null;
    }
  }
  return stripeInstance;
}

// Create a mock checkout session for development
function createMockCheckoutSession(saleId, saleTitle) {
  console.log('🧪 Using MOCK checkout session (development mode)');
  const mockUrl = `${frontendUrl}/payment-success?sale_id=${saleId}&session_id=mock_session_${Date.now()}`;
  return {
    id: `mock_session_${Date.now()}`,
    url: mockUrl,
  };
}

export default async function handler(req, res) {
  console.log('\n📌 createStripeCheckout handler invoked');
  console.log('   Method:', req.method);
  console.log('   Data:', JSON.stringify(req.body));

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ error: 'Method must be POST' });
  }

  try {
    const { saleId, saleTitle } = req.body;

    if (!saleId) {
      console.log('❌ Missing saleId in request');
      return res.status(400).json({ error: 'saleId is required' });
    }

    console.log('📋 Processing payment for sale:', saleId);

    // Use development mock if Stripe is not configured
    if (isDevelopment) {
      console.log('⚠️  DEVELOPMENT MODE: Using mock Stripe checkout');
      const mockSession = createMockCheckoutSession(saleId, saleTitle);
      return res.status(200).json({
        url: mockSession.url,
        sessionId: mockSession.id,
        mode: 'development',
        message: 'This is a development/test checkout. In production, real Stripe payments would be processed.',
      });
    }

    // Use real Stripe in production
    const stripe = await initStripe();
    if (!stripe) {
      throw new Error('Stripe not initialized');
    }

    // Create Stripe checkout session
    console.log('🔄 Creating Stripe checkout session...');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `Urban Garage Sale Listing: ${saleTitle || 'Untitled Sale'}`,
              description: 'List your garage sale on Urban Garage Sale platform',
            },
            unit_amount: 299, // $2.99 AUD in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/payment-success?sale_id=${saleId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment-cancelled?sale_id=${saleId}`,
      metadata: {
        saleId: saleId,
        saleTitle: saleTitle || 'Untitled',
      },
    });

    console.log('✅ Checkout session created:', session.id);
    console.log('   URL:', session.url);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    
    return res.status(500).json({
      error: `Failed to create checkout: ${error.message}`,
      code: error.code,
    });
  }
}
