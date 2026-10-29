import { lazy } from 'react';
import Home from './pages/Home';
import __Layout from './Layout.jsx';

// Home is the landing page, so it ships in the main bundle. Every other page is loaded when
// it's first visited, and the admin dashboard is only ever downloaded by admins.
export const PAGES = {
    "About": lazy(() => import('./pages/About')),
    "AdminDashboard": lazy(() => import('./pages/AdminDashboard')),
    "Contact": lazy(() => import('./pages/Contact')),
    "CreateListing": lazy(() => import('./pages/CreateListing')),
    "Home": Home,
    "ListingDetails": lazy(() => import('./pages/ListingDetails')),
    "Login": lazy(() => import('./pages/Login')),
    "Payment": lazy(() => import('./pages/Payment')),
    "Privacy": lazy(() => import('./pages/Privacy')),
    "Profile": lazy(() => import('./pages/Profile')),
    "ResetPassword": lazy(() => import('./pages/ResetPassword')),
    "SavedListings": lazy(() => import('./pages/SavedListings')),
    "Terms": lazy(() => import('./pages/Terms')),
    "UrbanPay": lazy(() => import('./pages/UrbanPay')),
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
