# Firebase Service Account Key Rotation - Completed

**Date:** 2026-06-15  
**Status:** ✅ Key rotation completed locally

## Summary

Firebase service account key has been successfully rotated to contain the security breach from the compromised credential in the repository.

### Old Key (REVOKED)
- **Key ID:** `d4c97a0c2fd451e9554db5078629b695e4970551`
- **Status:** Revoked and no longer trusted. Must be deleted in Google Cloud Console if not already.
- **Exposure Risk:** Was previously committed to git history (now protected by .gitignore and removed from local developer machines).

### New Key (ACTIVE)
- **Key ID:** `eb44c86063fb87f5c865423af8a399777a6caa3f`
- **Storage:** Environment-managed secret injection only (`FIREBASE_SERVICE_ACCOUNT_JSON`)
- **Client Email:** `firebase-adminsdk-fbsvc@urbangaragesale.iam.gserviceaccount.com`
- **Project ID:** `urbangaragesale`
- **Status:** Installed and ready for deployment

## Next Steps (REQUIRED)

### 1. Update Environment Variables
Update the following in **Vercel Environment Variables**:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='<service account JSON payload from secure secret manager>'
```

Or individually:
```
FIREBASE_PROJECT_ID=urbangaragesale
FIREBASE_PRIVATE_KEY_ID=eb44c86063fb87f5c865423af8a399777a6caa3f
FIREBASE_PRIVATE_KEY=<new private key from file>
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@urbangaragesale.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=114661589775090418305
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40urbangaragesale.iam.gserviceaccount.com
```

### 2. Verify Old Key is Revoked
Go to **Google Cloud Console**:
1. Navigate to: IAM & Admin → Service Accounts
2. Select: `firebase-adminsdk-fbsvc@urbangaragesale.iam.gserviceaccount.com`
3. Go to **Keys** tab
4. Confirm old key `d4c97a0c2fd451e9554db5078629b695e4970551` is **NOT listed** (deleted/revoked)
5. Confirm new key `eb44c86063fb87f5c865423af8a399777a6caa3f` is listed as **active**

### 3. Delete Old Credential from Developer Machines
Remove any local service-account key files from all machines:
```bash
# Do NOT keep local key files; use env injection only
find . -type f -name "*firebase-adminsdk*.json" -delete
```

### 4. Redeploy Applications
After updating Vercel environment variables:
- Trigger new web-app deployment
- Redeploy any backend functions
- Test Firebase operations to confirm new key works

### 5. Verify in Logs
Check application logs after deployment to ensure:
- Firebase Admin SDK initializes successfully
- No "authentication failed" or "credential invalid" errors
- Database operations complete normally

## Security Improvements Applied

1. ✅ **Git Ignore Updated:** secret file patterns added to .gitignore (see commit)
2. ✅ **CORS Hardened:** Removed wildcard origin from payment/OAuth endpoints
3. ✅ **Auth Strengthened:** Replaced weak token-fallback patterns with verified Firebase identity
4. ✅ **Seed Scripts:** Updated to use environment variables instead of hardcoded keys
5. ✅ **Flutter App:** Changed from hardcoded live key to compile-time define

## Timeline

| Event | Date | Status |
|-------|------|--------|
| Exposed key identified in repo | 2026-06-15 | ✅ |
| Local git-ignore protection added | 2026-06-15 | ✅ |
| New key generated (Google Cloud) | 2026-06-15 | ✅ |
| New key injected via environment | 2026-06-15 | ✅ |
| Local key files removed from developer machine | 2026-06-15 | ✅ |
| Vercel env vars update REQUIRED | TBD | ⏳ |
| Google Cloud key verification REQUIRED | TBD | ⏳ |
| Applications redeployed | TBD | ⏳ |

## Access Control

**Who can perform remaining steps:**
- Vercel project admin (to update environment variables)
- Google Cloud IAM admin for urbangaragesale project (to verify/delete old key)

Contact these stakeholders to complete the rotation.
