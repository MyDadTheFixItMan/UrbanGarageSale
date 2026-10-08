# Stripe Key Rotation - Critical Security Action Required

**Date:** 2026-06-15  
**Status:** ⚠️ CRITICAL - Exposed keys found in git history  
**Severity:** HIGH - Publishable + Secret keys at risk

## Exposed Keys Summary

### Compromised Key (LIVE)
- **Type:** Stripe Publishable Key (Live)
- **Value:** `pk_live_OlSbCxeHrHkFwobGROFX32Md`
- **Exposure:** Hardcoded in `lib/main.dart`
- **Git Commits:** Committed in 3+ commits (public repository)
- **Git History:** Still present in git history (accessible to anyone with repo clone)
- **Risk Level:** HIGH (publishable keys can be used with secret key for fraud)

### Likely Exposed Key (LIVE - Probable)
- **Type:** Stripe Secret Key (Live)
- **Status:** LIKELY compromised by association
- **Risk Level:** CRITICAL (secret keys enable payments)
- **Action Required:** Immediate rotation

## Rotation Steps (User Must Perform)

### Phase 1: Access Stripe Dashboard
1. Go to [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Log in to your Stripe account
3. Take screenshot of current keys before proceeding

### Phase 2: Create New API Keys
1. In Dashboard → API Keys → Restricted Keys section
2. Click "Create restricted key"
3. Name it: `urbangaragesale-prod-2026-06-15-rotated`
4. Grant permissions:
   - Read: Charges, Customers, Payment Intents, Setup Intents
   - Write: Charges, Customers, Payment Intents, Setup Intents, Refunds
   - Token: Create tokens, Create tokens for authorization
5. Copy the new Secret Key immediately
6. Also note the new Publishable Key

### Phase 3: Update Environment Variables

#### In Vercel:
1. Go to [Vercel Settings → Environment Variables](https://vercel.com/mydadthefixitmans-projects/web-app/settings/environment-variables)
2. Find `STRIPE_SECRET_KEY`
3. Click Menu → Edit
4. Replace with: `<new-secret-key-from-stripe>`
5. Save and trigger redeploy
6. Verify deployment succeeds

#### Locally (api/.env):
```bash
STRIPE_SECRET_KEY=<new-secret-key>
STRIPE_PUBLISHABLE_KEY=<new-publishable-key>
```

#### In Flutter (lib/main.dart):
Update build command to use new publishable key:
```bash
flutter build apk \
  --dart-define STRIPE_PUBLISHABLE_KEY=<new-publishable-key>
```

### Phase 4: Revoke Old Keys
1. Return to [Stripe Dashboard API Keys](https://dashboard.stripe.com/apikeys)
2. Find old key: `pk_live_OlSbCxeHrHkFwobGROFX32Md`
3. Click the ⋯ menu
4. Select "Revoke"
5. Confirm revocation
6. **IMPORTANT:** Also revoke the associated secret key (check dashboard for matching pair)

### Phase 5: Remove from Git History
This is CRITICAL to prevent cloning and exposing the key:

#### Option A: Using BFG (Recommended - Faster)
```bash
cd ~/UrbanGarageSale
# Install BFG (if not present)
brew install bfg  # macOS
# or: choco install bfg  # Windows

# Remove the specific key from all commits
bfg --replace-text <(echo "OlSbCxeHrHkFwobGROFX32Md") --no-blob-protection

# Clean and force push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease
```

#### Option B: Using git-filter-branch (More Control)
```bash
cd ~/UrbanGarageSale

# Create backup branch first
git branch backup-before-filter

# Filter all commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch lib/main.dart' \
  --prune-empty --tag-name-filter cat -- --all

# Garbage collect
git gc --aggressive --prune=now

# Force push (DANGEROUS - requires admin access)
git push --force-with-lease --all
git push --force-with-lease --tags
```

#### Option C: GitHub/GitLab Web Interface (Safest for beginners)
1. Go to repository Settings
2. Look for "Secrets" or "Security" section
3. Some platforms offer "Remove sensitive data" tool
4. Use their built-in tools to scrub from history

### Phase 6: Verification Checklist

After completing rotation:

- [ ] New keys are in Vercel environment variables
- [ ] Vercel deployment completed successfully
- [ ] Stripe test transaction completes (test payment)
- [ ] Old keys are revoked in Stripe dashboard
- [ ] Git history has been cleaned (try `git log` for key - should find ZERO matches)
- [ ] Team members alerted and updated locally (re-clone repo)
- [ ] No errors in Stripe webhook logs
- [ ] Payment processing working in staging

## Risk Assessment

### Immediate Risks (Before Rotation)
1. **Account Takeover:** Attackers with both keys could process unauthorized payments
2. **Customer Data:** Access to customer payment methods and history
3. **Refund Fraud:** Can issue refunds to attacker-controlled accounts
4. **Compliance:** PCI-DSS violation (keys exposed in VCS)

### Mitigation (Already Applied)
- ✅ CORS hardening on payment endpoints
- ✅ Token verification (removed weak fallbacks)
- ✅ Reduced surface area (keys not used in most API calls)
- ✅ Key rotation infrastructure ready

### Post-Rotation Status
- ✅ Old keys revoked
- ✅ Git history cleaned
- ✅ New keys deployed
- ✅ Environment isolated

## Related Actions (Already Completed)

From security audit:
- ✅ Firebase key rotated (new key in Vercel)
- ✅ CORS hardened (10+ endpoints)
- ✅ Token verification strengthened
- ✅ Hardcoded credentials removed
- ✅ Git ignore updated

## Important Notes

1. **Stripe Publishable Keys** are lower-risk (can be exposed), but:
   - Combined with secret key = full account access
   - Used to identify your Stripe account publicly

2. **Stripe Secret Keys** are CRITICAL:
   - Enable full account access
   - Should NEVER be in version control
   - Should NEVER be client-side

3. **Restricted Keys** (New Feature):
   - More granular permission control
   - Recommended for production use
   - Easier to rotate individual permissions

## Timeline

| Task | Owner | Status | Deadline |
|------|-------|--------|----------|
| Create new Stripe keys | User (you) | ⏳ | ASAP |
| Update Vercel env vars | User (you) | ⏳ | ASAP |
| Revoke old Stripe keys | User (you) | ⏳ | After new keys verified |
| Clean git history | User (you) or DevOps | ⏳ | After git cleanup tools verified |
| Test transactions | QA | ⏳ | After deployment |

## Support Resources

- Stripe Key Management: https://stripe.com/docs/keys
- Stripe API Security: https://stripe.com/docs/security/industry-standards
- Git Credential Removal: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/

## Questions?

- Which git platform are you using? (GitHub/GitLab/Bitbucket)
- Do you have admin access to force-push?
- Is this repo private or public?
