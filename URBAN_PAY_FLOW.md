# Urban Pay - Payment Flow & Seller Onboarding Guide

## Overview

Urban Pay has **two payment methods**:

1. **Cash Sales** - Sellers manually record cash payments received
2. **Card Payments (Tap to Pay)** - Buyers pay with debit/credit cards contactlessly using the mobile app

---

## Payment Methods Explained

### 1. Cash Sales (Web & Mobile)

**How It Works:**
- Seller manually enters the amount received and item description
- Records the transaction to track earnings
- No additional setup required

**Where It's Used:**
- Web app: `/UrbanPay` page
- Mobile app: Dashboard → "Record Cash Sale"

**Cash Sales Flow:**
```
Buyer hands cash → Seller enters amount → System records sale → Earnings update
```

**Supported On:**
- ✅ All browsers (no special hardware needed)
- ✅ Mobile and tablet
- ✅ Real-time earnings tracking


### 2. Card Payments (Tap to Pay)

**How It Works:**
- Buyer taps their phone (Apple Pay, Google Pay, Samsung Pay) on seller's phone
- NFC reader processes the payment securely through Stripe
- Transaction is recorded and seller gets paid
- Works for debit cards, credit cards, and digital wallets

**Supported Devices:**
- ✅ iPhone 16+ (with iOS 18+)
- ✅ Android 8+ with NFC capability
- ✅ Any device with Apple Pay, Google Pay, or Samsung Pay support

**Card Payments Flow:**
```
Buyer → Payment Sheet (select amount) → Tap phone (Apple/Google Pay) → Stripe processes → Sale recorded → Seller earnings updated
```

**Seller Setup Required:**
- ⏳ Stripe Connect account (for receiving payments)
- ⏳ Account linked to seller profile
- ⏳ Bank account for deposits

---

## Seller Onboarding for Card Payments

### Step 1: Enable Card Payments in Seller Profile

**On the Web App:**
1. Go to your **Profile** page
2. Look for **Payment Settings** section
3. Click **Enable Card Payments**
4. You'll be redirected to Stripe to connect your account

**What Information Stripe Needs:**
- Name and email
- Business address
- Bank account details (for payouts)
- Phone number (for verification)

### Step 2: Complete Stripe Connect Verification

1. Stripe will verify your identity
2. You may need to provide:
   - Photo ID (driver's license, passport)
   - Business information
   - Bank routing number and account number
3. Verification typically takes 24-48 hours

### Step 3: Enable Tap to Pay on Mobile

Once your seller account has card payments enabled:

1. Open the Flutter mobile app
2. Go to **Urban Pay** (bottom navigation)
3. Select the **Tap to Pay** tab
4. The "Activate Reader" button will be enabled
5. Follow on-screen instructions to activate NFC reader

### Step 4: Start Accepting Card Payments

1. **Set the payment amount** (buyer tells you the price)
2. **Tap "Charge" button**
3. **Buyer taps their phone** on your reader
4. **Confirm the payment** on your screen
5. **Transaction complete** - sale is recorded

---

## Payment Processing & Fees

### Cash Sales
- **Fee**: None
- **Payout**: Manual (seller tracks separately)
- **Timing**: Manual collection from buyer

### Card Payments (Stripe)
- **Fee**: 2.9% + $0.30 per transaction
  - Example: $50 sale = $1.45 + $0.30 = $1.75 fee → $48.25 to seller
- **Payout**: Automatic to your bank account
- **Timing**: Typically 1-2 business days after transaction

### Fee Breakdown Example

| Sale Amount | Stripe Fee | Your Earnings |
|-----------|-----------|-------------|
| $10.00 | $0.59 | $9.41 |
| $25.00 | $1.03 | $23.97 |
| $50.00 | $1.75 | $48.25 |
| $100.00 | $3.20 | $96.80 |

---

## Current Status

### What's Working Now ✅
- **Cash Sales**: Full integration on web and mobile
- **Seller Stats**: Total earnings and sales count
- **Stats Refresh**: Manual refresh button on Urban Pay page
- **Real-time Tracking**: All sales recorded to Firestore

### What's Next ⏳
1. **Seller Profile Integration** - Link Stripe Connect account
2. **Card Payment Onboarding Flow** - Guided setup for new sellers
3. **Payout Management** - View upcoming payouts and history
4. **Transaction Details** - Download receipts and reports

---

## Troubleshooting

### Cash Sales Not Appearing

**Issue**: Cash sale is recorded but stats don't update

**Solutions**:
1. Click the **Refresh** button (🔄) on Urban Pay page
2. Wait a few seconds - Firestore may take time to update
3. Check browser console (F12) for error messages
4. Ensure you're logged in and verified

**Note**: If you see "Firestore error: Forbidden", Firebase credentials haven't been configured on Vercel. Contact support.

### Tap to Pay Not Available

**Reason**: Your seller account doesn't have Stripe Connect enabled yet

**To Enable**:
1. Go to **Profile** page
2. Find **Payment Settings**
3. Click **Enable Card Payments**
4. Complete Stripe Connect setup
5. Wait for verification (24-48 hours)

### Card Transaction Failed

**Common Reasons**:
- Buyer's card was declined (insufficient funds, fraud check, etc.)
- Network connection issue
- Reader wasn't activated properly

**Solution**:
- Try the payment again
- Ensure NFC is enabled on both phones (Settings → NFC → On)
- Move phones closer together during tap
- If buyer's card fails, they can try a different card or pay via Apple Pay/Google Pay

---

## Security & Privacy

### Cash Sales
- Recorded to Firestore with seller ID
- Only you can see your own sales
- No payment information stored (manual collection)

### Card Payments
- Processed through Stripe (PCI-DSS compliant)
- No card data touches your phone (Stripe handles encryption)
- Each transaction is tokenized and secured
- Your Stripe Connect account is separate and secure
- Automatic 1099-K tax reporting for IRS

---

## FAQ

**Q: Can I use both cash and card payments at the same garage sale?**
A: Yes! Use whichever method works best for each transaction.

**Q: Are there limits on card payment amounts?**
A: Stripe has default limits ($10,000 per transaction), but these can be adjusted as your account matures.

**Q: What if a card payment fails?**
A: The transaction won't be recorded. The buyer can try again with a different payment method or pay cash instead.

**Q: When do I get paid?**
A: Card payments are deposited to your bank account within 1-2 business days.

**Q: Can I refund a card payment?**
A: Yes, through Stripe. Go to your transaction history and select "Issue Refund".

**Q: Do I pay fees on cash sales?**
A: No, cash sales have no fees. You keep 100% of the amount.

**Q: What if I want to disable card payments?**
A: You can disable them in Payment Settings. Existing transactions remain recorded.

---

## Next Steps

1. **If using cash only**: You're all set! Use the "Record Cash Sale" button
2. **If accepting cards**: 
   - Go to Profile → Payment Settings
   - Click "Enable Card Payments"
   - Complete Stripe Connect setup
   - Download the mobile app and activate Tap to Pay reader
3. **Questions?** Check the Urban Pay help section or contact support

---

For technical details about the API and payment processing, see [URBAN_PAY_TECHNICAL.md](./URBAN_PAY_TECHNICAL.md).
