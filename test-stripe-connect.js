// Quick test to check if Stripe Connect is enabled
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function testStripeConnect() {
  try {
    console.log('Testing Stripe Connect setup...');
    console.log('API Key:', process.env.STRIPE_SECRET_KEY?.substring(0, 20) + '...');

    // Try to create a test account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'AU',
      email: 'test@example.com',
      business_type: 'individual',
      individual: {
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        address: {
          line1: '123 Test St',
          city: 'Sydney',
          state: 'NSW',
          postal_code: '2000',
          country: 'AU',
        },
      },
      business_profile: {
        product_description: 'Test product',
        support_url: 'https://example.com',
        url: 'https://example.com',
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: '127.0.0.1',
      },
    });

    console.log('✅ SUCCESS! Stripe Connect is enabled.');
    console.log('Test account created:', account.id);
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    if (error.message.includes('signed up for Connect')) {
      console.log('\n⚠️  Stripe Connect is NOT enabled on your account.');
      console.log('Steps to enable:');
      console.log('1. Go to https://dashboard.stripe.com');
      console.log('2. Settings → Partners → Connect');
      console.log('3. Click "Enable Stripe Connect"');
    }
  }
}

testStripeConnect();
