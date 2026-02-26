# ✅ URBANGARAGESALE LIVE TESTING - READY TO GO!

## Status: 🟢 FULLY OPERATIONAL

Both servers are now running and ready for live Stripe payment testing!

## 🚀 Currently Running

### API Server ✅
- **URL**: http://localhost:3000
- **Status**: Running
- **Terminal**: Keep running in background
- **Endpoints**:
  - `POST /createStripeCheckout` - Create Stripe checkout session
  - `POST /verifyStripePayment` - Verify payment completion
  - `GET /health` - Health check

### Web App ✅
- **URL**: http://localhost:5175
- **Status**: Running and ready
- **Terminal**: Keep running in background
- **Features**: Full garage sale listing platform with payment integration

## 📋 Configuration Status

| Setting | Status | Value |
|---------|--------|-------|
| Stripe Public Key | ✅ Set | `pk_test_51SsiIg7hRwXmBUxSj4nA0S5Cd0V5h3B7...` |
| Stripe Secret Key | ✅ Set | `sk_test_51SsiIg7hRwXmBUxSkEjJ8K9lL0mN1oP2...` |
| Google Places API | ✅ Set | `AIzaSyAQOInrJXkCNRBB5QdzW7vFerRoVO4AfP4` |
| API Base URL | ✅ Set | `http://localhost:3000` |
| Node Modules | ✅ Installed | All dependencies ready |
| Setup Validation | ✅ Passed | All 7 checks passed |

## 🧪 Test Payment Flow

### Step 1: Create a Listing
1. Open http://localhost:5175
2. Sign in with test account
3. Click "Create Listing"
4. Fill in listing details:
   - Title: "Test Garage Sale"
   - Address: Any Australian address
   - Upload a photo
   - Set dates
5. Click "Save Draft"

### Step 2: Submit for Payment
1. On profile or listing, click "Submit for Payment"
2. Click "Complete Payment"
3. You'll be redirected to Stripe Checkout

### Step 3: Use Test Card
1. **Card Number**: `4242 4242 4242 4242`
2. **Expiry**: Any future date (e.g., `12/25`)
3. **CVC**: Any 3 digits (e.g., `123`)
4. **Name**: Any name
5. Click "Pay $10.00"

### Step 4: Verify Payment
1. You'll be redirected back to http://localhost:5175/Payment
2. Should see "Payment Successful!" message
3. Listing status changes to "active"
4. Payment record created

### Step 5: Check Admin Dashboard
1. Go to http://localhost:5175/admin
2. Click "Payments" tab
3. See your payment listed with:
   - Amount: $10.00
   - Your name
   - Suburb and state
   - Payment date and time
   - Transaction ID

## 📊 Test Stripe Cards

| Card Number | Result | Use Case |
|------------|--------|----------|
| 4242 4242 4242 4242 | ✅ Success | Standard test |
| 4000 0000 0000 0002 | ❌ Declined | Test decline |
| 4000 0025 0000 3155 | ⚠️ Auth required | Test 3D Secure |

**For ALL cards:**
- Expiry: Any future date (MM/YY)
- CVC: Any 3 digits
- Name: Any name
- ZIP: Any digits

## 🔧 How to Use

### Open Web App
```
http://localhost:5175
```

### Access Admin Dashboard
```
http://localhost:5175/admin
```

### Check API Health
```
http://localhost:3000/health
```

### Monitor API Logs
Check the terminal running the API server for:
- Stripe session creation logs
- Payment verification logs
- Error messages

### Monitor Web App
Open browser DevTools (F12) to see:
- Console logs for API calls
- Network requests to API server
- Error messages

## 🎯 What You Can Test

✅ **Full Payment Flow**
- Create listing
- Upload photos
- Submit for payment
- Pay with Stripe
- Verify in dashboard

✅ **Admin Features**
- Approve/reject listings
- View payment history
- Filter payments by date/suburb/state
- Delete listings
- View user management

✅ **Address Features**
- Google Places autocomplete
- Suburb/postcode validation
- State selection

✅ **Listing Features**
- Draft saving
- Photo upload
- Status workflow
- End date handling
- Auto-expiry to "completed"

## 🛑 How to Stop Servers

When done testing, stop the servers:

```powershell
# In API terminal: Ctrl+C
# In Web terminal: Ctrl+C
```

## 🚀 To Restart Later

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web
```

## 💡 Pro Tips

1. **Check Payments**: Go to Admin > Payments tab to see all test transactions
2. **Use Test Email**: During checkout, any test email works (e.g., test@example.com)
3. **Multiple Tests**: Create multiple listings to test filtering
4. **Clear Data**: localStorage can be cleared in browser DevTools if needed
5. **API Logs**: Watch the API terminal to see payment processing in real-time

## 🔐 Security Notes

- Test keys only (pk_test_, sk_test_)
- No real charges will be made
- Data stored in localStorage (local only)
- HTTPS not required for localhost
- All transactions verified with Stripe

## 📱 Test Multiple Scenarios

### Scenario 1: Successful Payment
- Use card 4242 4242 4242 4242
- Should see success message
- Payment appears in admin dashboard

### Scenario 2: Listing Approval
- Create and pay for listing
- Go to Admin > Pending Approval
- Click "Approve"
- Listing status changes to "active"

### Scenario 3: Payment Filtering
- Create 3+ test payments
- Go to Admin > Payments
- Test filters:
  - By date (Today, Last 7 Days, etc.)
  - By suburb (if using different suburbs)
  - By state (if using different states)

### Scenario 4: Listing Expiry
- Create a listing with end date in the past
- Go to Admin > All Listings
- Should see status as "completed"

## ✨ All Features Ready to Test

| Feature | Status | How to Test |
|---------|--------|------------|
| Address autocomplete | ✅ | Type address in CreateListing |
| Photo upload | ✅ | Click photo button, select file |
| Draft saving | ✅ | Create listing, click Save Draft |
| Payment checkout | ✅ | Click "Complete Payment" |
| Payment verification | ✅ | Use test card 4242... |
| Admin dashboard | ✅ | Go to /admin |
| Payments tab | ✅ | Admin > Payments |
| Payment filtering | ✅ | Use dropdown filters |
| Listing approval | ✅ | Admin > Pending Approval |
| Listing deletion | ✅ | Admin > All Listings |
| Auto-expiry | ✅ | End date in past |

## 🐛 If Something Goes Wrong

### "Failed to create checkout session"
- Check API server is running (Terminal 1)
- Check browser console (F12) for error details
- Verify STRIPE_SECRET_KEY in `.env`

### "Cannot reach API"
- Ensure API is running on http://localhost:3000
- Check VITE_API_BASE_URL is correct
- Restart API server

### "Payment page blank"
- Check browser console for errors
- Verify API is responding
- Try refreshing the page

### "Page not loading"
- Check web app is running on http://localhost:5175
- Try port 5176 if 5175 is in use
- Restart web server

## 📞 Quick Reference

| Need | Command |
|------|---------|
| Start API | `npm run dev:api` |
| Start Web | `npm run dev:web` |
| Check setup | `node validate.js` |
| Stop all | `Ctrl+C` in both terminals |

## 🎉 You're Ready!

The UrbanGarageSale platform is now running with full Stripe payment integration. All systems are operational and ready for testing.

**Start testing now:**
1. Open http://localhost:5175
2. Create a listing
3. Submit for payment
4. Use test card: 4242 4242 4242 4242
5. Check Admin Dashboard > Payments

Happy testing! 🚀
