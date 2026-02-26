# User Deletion Debugging Guide

## Issue
User deleted from admin dashboard appears to be deleted (toast shows success), but user still appears in the list after refresh.

## Enhanced Logging
I've added comprehensive logging to track the deletion flow:

### Browser Console (Frontend)
**File**: `web-app/src/api/firebaseClient.js` (User.delete method)

Logs to expect when deleting a user:
```
🔵 Starting user deletion for id: [userId]
✓ Got ID token for: [admin@email.com]
🔵 Delete API response status: 200
🔵 Delete API response: {success: true, message: "User deleted successfully"}
✓ User deletion succeeded
```

Or error logs:
```
❌ User.delete() error: [error message]
```

### Admin Dashboard Console (Frontend)
**File**: `web-app/src/pages/AdminDashboard.jsx` (deleteUserMutation)

Logs to expect:
```
🟦 Deleting user: [userId]
🟦 User deleted successfully: {id: [userId], deleted: true}
🟦 Delete onSuccess - invalidating and refetching allUsers query
```

Or error:
```
🔴 Delete failed: [error message]
🔴 Delete mutation error: [error details]
```

### Server Console (Node.js Backend)
**File**: `API/server.js` (/deleteUser endpoint)

Logs to expect:
```
🔵 deleteUser request received for userId: [userId]
✓ Token verified for: [admin@email.com]
✓ Admin verification passed
🔵 Deleting from Firebase Auth...
✓ User deleted from Firebase Auth
🔵 Deleting from Firestore...
✓ User deleted from Firestore
✓ User [userId] deleted successfully by admin [admin@email.com]
```

Or errors:
```
❌ No auth header provided
❌ User is not an admin
🔵 User not found in Auth, deleting from Firestore only...
```

## Testing Steps

### Step 1: Create Test User
1. Go to admin dashboard
2. Note a test user's ID (look in users list)

### Step 2: Check Server is Running
```bash
cd API
node server.js
```
Server should log: `✓ Server running on 3000`

### Step 3: Delete from Admin Dashboard
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Click delete button next to a test user
4. Confirm deletion in dialog

### Step 4: Check All Logs
1. **Browser Console** (F12 → Console tab)
   - Should show all the 🔵 and ✓ logs listed above
   - Look for any ❌ errors

2. **Terminal/Server Console**
   - Should show server-side logs
   - Look for "User [userId] deleted successfully" or error messages

3. **Firestore Console** (Firebase console)
   - Go to Firestore → users collection
   - Verify the user document is actually gone

### Step 5: Query the User
If user is still visible in admin list after deletion:
1. Let admin page reload/refetch
2. If user STILL appears, check:
   - Is there a user with same email created after deletion?
   -Could frontend be caching old data somewhere else

## Common Issues & Solutions

### Issue 1: API returns 401 Unauthorized
**Cause**: Firebase token verification failing
**Solution**: 
- Ensure you're logged in as an admin user
- Check that Admin SDK has correct credentials
- Verify server.js can access Firebase Admin SDK

### Issue 2: API returns 403 Forbidden  
**Cause**: User attempting deletion is not an admin
**Solution**:
- Verify your user account has `role: 'admin'` in Firestore
- In Firestore console, go to `users` collection, find your user, confirm `role` field = "admin"

### Issue 3: "User not found in Auth" message
**Cause**: User might already be deleted from Firebase Auth but not Firestore
**Solution**: This is actually okay - the endpoint has a fallback to delete from Firestore
- User should still be deleted completely

### Issue 4: User still in list after "successful" deletion
**Cause**: Possible reasons:
1. Deletion actually failed silently (check error logs)
2. Query cache not invalidating properly
3. Different user with same email was created
4. Firestore delete didn't actually work

**Debug steps**:
- Check server logs for any errors
- Check browser console for fetch errors
- Manually check Firestore to verify document is gone
- Check if another user with same email exists

## Direct Firestore Verification

### Via Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select UrbanGarageSale project
3. Go to Firestore Database
4. Open `users` collection
5. Search for the test user by ID or email
6. If document is gone → deletion worked, issue is elsewhere
7. If document exists → deletion endpoint didn't delete from Firestore

### Via Local Testing (if you have Firebase SDK installed)
```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

// Check if user exists
const doc = await db.collection('users').doc('USER_ID_HERE').get();
console.log('User exists:', doc.exists);
console.log('User data:', doc.data());
```

## Query Cache Invalidation

The deletion mutation now includes both:
1. `queryClient.invalidateQueries()` - marks cache as stale
2. `queryClient.refetchQueries()` - forces immediate refetch

If user still appears after deletion:
1. Check if `allUsers` query is actually re-running
2. The query should call `firebase.entities.User.filter()` again
3. If Firestore doesn't have the user document, it won't be in results

## Quick Debugging Checklist

When user deletion appears to fail:
- [ ] Check browser console for DELETE logs (🔵, ✓, or ❌)
- [ ] Check server console for endpoint logs
- [ ] Verify response status is 200
- [ ] Check Firestore console directly to see if user doc is gone
- [ ] Confirm deleted user re-appears or never disappears
- [ ] Note exact error messages from logs
- [ ] Share console logs output for investigation

## Next Steps If Still Failing

1. **Screenshot the logs** from both browser console and server terminal
2. **Take a Firestore screenshot** showing the users collection
3. **Note the user ID** of the test user you're deleting
4. **Share these with developer** along with info about:
   - What error message appeared (if any)
   - Whether user eventually appeared again
   - Any network/CORS errors in browser

## Testing Endpoint Directly (Advanced)

You can test the API endpoint directly without the UI:

```bash
curl -X POST http://localhost:3000/deleteUser \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"userId": "USER_ID_TO_DELETE"}'
```

To get your ID token from browser console:
```javascript
// In browser console (F12)
const token = await firebase.auth.currentUser.getIdToken();
console.log(token);
// Copy the output and use in curl command above
```

This tells you immediately if the API call itself is working.
