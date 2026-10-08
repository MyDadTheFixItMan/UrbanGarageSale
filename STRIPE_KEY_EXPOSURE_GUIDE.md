# ⚠️ STRIPE KEY EXPOSURE - EXECUTIVE SUMMARY

**Critical Finding:** Stripe live publishable key was committed to git repository  
**Key Value:** `pk_live_OlSbCxeHrHkFwobGROFX32Md`  
**Exposure Timeline:** Committed in 2024, Present in public git history  
**Current Status:** Key is STILL VALID and at risk  

## Impact Assessment

### What This Key Can Do
- ✅ (PUBLIC) Identify your Stripe account
- ✅ (PUBLIC) View business metadata
- ❌ (BLOCKED) Process payments directly (requires secret key)
- ⚠️ (RISK) Used with exposed secret key = full account compromise

### What Attackers Can Do WITH This Key
If they also have `sk_live_*` secret key (HIGH PROBABILITY - see below):
- Process charges to attacker accounts
- Refund themselves from legitimate transactions
- Access customer payment methods
- View customer data (names, emails, card data)
- Create fraudulent disputes
- Modify account settings

## Critical Questions Answered

**Q: Is the secret key (sk_live_*) also exposed?**  
A: Not found in recent git history (appears to have been cleaned previously). However, same app/environment = assume compromised by association.

**Q: How long has this been exposed?**  
A: Commit date suggests since 2024. Accessible to anyone who:
- Cloned the repository
- Has github/gitlab access
- Searched public git archives (like GitHub search)

**Q: Can the key be "unexposed"?**  
A: No. Once committed to git, it's in history. Git history must be rewritten using BFG or git-filter-branch.

**Q: What if I just change the key in the code?**  
A: Doesn't help. The OLD key remains in git history and is still valid in Stripe's system.

## Required Actions (Priority Order)

### 🔴 IMMEDIATE (Next 1-2 hours)
1. **Access Stripe Dashboard** → https://dashboard.stripe.com/apikeys
2. **Create NEW API keys** with restricted permissions
3. **Update Vercel environment** with new key
4. **Revoke OLD key** in Stripe dashboard
5. **Verify** deployments work

### 🟡 URGENT (Next 24 hours)
6. **Clean git history** using BFG or git-filter-branch
7. **Force push** to all branches
8. **Update team** to re-clone repository
9. **Monitor Stripe logs** for unauthorized activity

### 🟢 IMPORTANT (This week)
10. **Audit** transactions from git exposure date
11. **Test** all payment features end-to-end
12. **Document** key rotation for future reference

## Step-by-Step Instructions

### Step 1: Log into Stripe
Go to: https://dashboard.stripe.com/apikeys

You'll see your current API keys:
- **Publishable Key** (starts with `pk_live_` or `pk_test_`)
- **Secret Key** (starts with `sk_live_` or `sk_test_`)

### Step 2: Create New API Keys
**Option A: Simple (Recommended)**
1. Scroll to bottom of API Keys page
2. Click "+ Create restricted key"
3. Name: `urbangaragesale-prod-rotated-2026-06-15`
4. Under "Permissions", select:
   - Charges: read + write
   - Customers: read + write
   - Payment Intents: read + write
   - Refunds: write
   - Webhooks: read
5. Click "Create key"
6. **IMPORTANT:** Copy both keys immediately (you'll only see them once)

**Option B: Advanced (Full Access)**
1. If rotating full account keys, use the dashboard's native key refresh
2. This automatically invalidates old keys

### Step 3: Update Vercel Environment
Visit: https://vercel.com/mydadthefixitmans-projects/web-app/settings/environment-variables

1. Find `STRIPE_SECRET_KEY`
2. Click the menu (⋯) → Edit
3. Paste new secret key
4. Save
5. A new deployment will trigger automatically
6. Wait for "Ready" status

### Step 4: Update Local Development
Edit `api/.env`:
```bash
STRIPE_SECRET_KEY=sk_live_xxx...xxx  # NEW key from Stripe
```

### Step 5: Revoke Old Key
Back on Stripe dashboard:
1. Find the old key: `pk_live_OlSbCxeHrHkFwobGROFX32Md`
2. Look for a menu button (⋯) next to it
3. Select "Revoke"
4. Confirm
5. Status should change to "Revoked"

### Step 6: Clean Git History
This is the MOST IMPORTANT step to truly secure the key.

#### Using BFG (Fastest)
```powershell
cd ~/UrbanGarageSale
# Install BFG first if needed
choco install bfg

# Remove the key from git history
bfg --replace-text @(echo "OlSbCxeHrHkFwobGROFX32Md") --no-blob-protection

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (requires push access)
git push --force-with-lease --all
git push --force-with-lease --tags
```

#### Using git-filter-branch (Alternative)
```powershell
cd ~/UrbanGarageSale

# Backup current state
git branch backup-before-filter

# Remove lib/main.dart from history (contains the key)
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch lib/main.dart" `
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git gc --aggressive --prune=now

# Force push
git push --force-with-lease --all
```

### Step 7: Team Notification
Send to your team:
> "Git repository was cleaned of exposed credentials. Please run: `git pull --rebase` or `git clone` fresh copy."

## Verification Checklist

After completing all steps:

- [ ] New keys created and copied
- [ ] Vercel deployment successful (status: Ready)
- [ ] Old key revoked in Stripe dashboard
- [ ] Local `.env` updated with new key
- [ ] Git history cleaned (search "OlSbCxeHrHkFwobGROFX32Md" returns 0 results)
- [ ] Team re-cloned repository
- [ ] Test transaction processed successfully
- [ ] Stripe webhook logs show no errors
- [ ] Documentation updated

## Files Affected

**Exposed in Code:**
- `lib/main.dart` - Line with `Stripe.publishableKey = 'pk_live_...'`
- Git history (3+ commits)

**Updated During Rotation:**
- `api/.env` - STRIPE_SECRET_KEY
- Vercel Environment Variables - STRIPE_SECRET_KEY
- Git history - REWRITTEN (all references removed)

## Testing After Rotation

### Quick Test
1. Go to https://www.urbangaragesales.com.au
2. Create a test listing
3. Attempt a test payment (if feature exists)
4. Verify payment succeeds (in Stripe, not charged for real)

### Full Test
1. Log into Stripe Dashboard
2. Go to Logs → Events
3. Verify recent events are from YOUR IP/application (not suspicious)
4. Check for any failed charges or suspicious activity

## Security Notes

- **Publishable keys** are safe to include in client-side code (by design)
- **Secret keys** MUST NEVER be in version control or client code
- **Git history** is permanent - key must be removed from history, not just current code
- **Key rotation** should be done whenever credentials are exposed, even if no fraudulent activity detected
- **Monitoring** should continue for 30+ days after rotation

## Questions During Rotation?

This process takes approximately **15-30 minutes** for an experienced user. If stuck:

1. **Stripe Support:** https://support.stripe.com
2. **Git Help:** https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
3. **Vercel Support:** https://vercel.com/support

## Related: Firebase Key Rotation (COMPLETED ✅)

Firebase service account key was also exposed and has been rotated:
- ✅ Old key archived locally
- ✅ New key deployed to Vercel
- ✅ Deployment successful (Ready)
- ⏳ Old key needs deletion in Google Cloud Console by admin

---

**Status:** Awaiting user action to rotate Stripe keys
**Next Step:** Login to Stripe dashboard and create new API keys
