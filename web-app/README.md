**Welcome to the UrbanGarageSale web app** 

**About**

This is the React/Vite web application for UrbanGarageSale, a garage sale finder platform built with Firebase.

**Edit the code in your local development environment**

This project contains everything you need to run the web app locally with Firebase backend integration.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory (`web-app`)
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Stripe Configuration
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_key

# API Configuration
VITE_API_BASE_URL=http://localhost:3000
```

5. Run the app: `npm run dev`

**Running the Full Stack**

From the root project directory:
- Terminal 1: `npm run dev:api` (starts API server)
- Terminal 2: `npm run dev:web` (starts web app)

Or run both: `npm run dev`

**Docs & Support**

See the main README.md and documentation files in the root project directory for more information.
