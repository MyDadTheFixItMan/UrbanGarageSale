# UrbanGarageSale Project - AI Development Guide

## Project Overview
UrbanGarageSale is a **dual-stack application** combining:
- **Flutter Mobile/Desktop App** (`lib/`, `pubspec.yaml`) - Garage sale finder application
- **React Web App** (`web-app/`) - Web version with Stripe integration  
- **Backend APIs** (`API/`) - Deno-based serverless functions using Firebase Admin SDK (authentication layer)

This is NOT a traditional single-framework project. The Flutter app and web app are separate UIs accessing shared backend services.

## Architecture & Key Integration Points

### Authentication Layer
- **Core**: Firebase Authentication + Firestore
- **Web implementation**: `web-app/src/lib/AuthContext.jsx` + `web-app/src/api/firebaseClient.js`
- **User state**: AuthContext provides `isAuthenticated`, `user`, and `isLoadingAuth` globally
- **Login flow**: Uses Firebase email/password and SMS phone verification
- **Backend**: Firebase Admin SDK in Deno edge functions for API authentication
- **Critical**: Always check `isLoadingAuth` during auth initialization to avoid race conditions

### Web App Stack (React + Vite)
- **Framework**: React 18 + React Router + Vite
- **UI Library**: Radix UI components + Tailwind CSS (see `web-app/tailwind.config.js` for CSS variables)
- **Form & Validation**: React Hook Form + Zod
- **Data Fetching**: TanStack Query (React Query) with `web-app/src/lib/query-client.js`
- **Routing**: Custom page system via `web-app/src/pages.config.js` - exports PAGES object mapping page names to components
- **Pages**: Home, CreateListing, ListingDetails, Login, Payment, Profile, SavedListings, AdminDashboard
- **Key files**: `web-app/src/Layout.jsx` handles header/nav, `web-app/src/App.jsx` is the Router container

### Backend APIs (Deno/TypeScript)
- **Files**: `API/handyApi.ts`, `createStripeCheckout.ts`, `verifyStripePayment.ts`
- **Pattern**: Each file is an edge function served via `Deno.serve()`
- **Authentication**: All endpoints validate user via Firebase ID token from Authorization header
- **Firestore**: Payments and sales data stored in Firestore collections
- **External integrations**: HandyAPI (suburb search/validation), Stripe payment processing
- **Environment**: Uses `Deno.env.get()` for API keys (Stripe) and Firebase project ID

### Mobile/Desktop App (Flutter)
- **State**: Currently uses setState pattern (see `lib/main.dart`)
- **UI**: Material Design 3 with deep purple seed color
- **Status**: Minimal boilerplate - main app structure to be expanded

## Critical Workflows

### Running the Web App
```bash
cd web-app
npm install        # Install dependencies
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint:fix   # Format and fix ESLint issues
```

### Running the Flutter App
```bash
flutter pub get    # Get dependencies
flutter run        # Run on connected device/emulator
flutter build apk  # Android release
```

### Working with APIs
- Edit files in `API/` directory
- Deploy via Deno deployment platform (functions are edge functions)
- Test locally: Functions must handle Firebase authentication via ID tokens

## Project-Specific Patterns

### Page Routing in Web App
- Pages are registered in `pages.config.js`, not via file-based routing
- Use `createPageUrl()` helper from `web-app/src/utils` to generate internal links
- Layout wrapper provides header/nav, receives `currentPageName` prop
- AuthProvider wraps the entire app for global auth state

### UI Components
- Located in `web-app/src/components/` (Radix UI primitives + custom)
- Custom components: `SuburbAutocomplete`, `UserNotRegisteredError`
- Map component in `web-app/src/components/map/`
- Listings components in `web-app/src/components/listings/`

### Form Handling (Web)
- Use React Hook Form with Zod for validation
- Example: Payment form integrates Stripe via `@stripe/react-stripe-js`
- HandyAPI suburb search used in address fields

### External Services
- **HandyAPI**: Suburb autocomplete & validation (see `web-app/src/api/handyApiService.js`)
- **Stripe**: Payment processing with webhook verification (`API/verifyStripePayment.ts`)
- **Firebase**: Authentication and user management for both web & mobile

## Key Environment Variables
Web app expects these in `web-app/.env.local`:
- Stripe public key configuration
- Firebase credentials and endpoints

API functions expect:
- `HandyAPI`: API key for suburb lookup
- Stripe webhook secrets & API keys

## Conventions & Notes
- **Tailwind CSS**: Use HSL variables from theme config (--primary, --accent, etc.)
- **Icons**: Lucide React (`lucide-react`) for consistent iconography
- **Toast notifications**: `react-hot-toast` and custom `Toaster` component
- **Dark mode**: Configured via `next-themes` (class-based)
- **Admin features**: Conditional rendering based on `user.role === 'admin'`
