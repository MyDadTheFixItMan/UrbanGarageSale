// Create Stripe Checkout session for listing purchases
// This returns a URL to redirect the user to Stripe Checkout

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

// Lazy load Stripe
let stripeInstance = null;

async function initStripe() {
  if (!stripeInstance) {
    try {
      const Stripe = (await import('stripe')).default;
      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
      }
      stripeInstance = new Stripe(stripeSecretKey);
      console.log('✅ Stripe client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Stripe:', error.message);
      throw error;
    }
  }
  return stripeInstance;
}

export default async function handler(req, res) {
  console.log('\n📌 createStripeCheckout handler invoked');
  console.log('   Method:', req.method);
  console.log('   Body:', JSON.stringify(req.body));

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

    // Initialize Stripe
    const stripe = await initStripe();

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
