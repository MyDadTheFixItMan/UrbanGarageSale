import React from 'react';
import { Plus, Heart, LogIn } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// What the popup says for each menu item that needs an account.
const MESSAGES = {
    CreateListing: {
        icon: Plus,
        title: 'Sign in to create a listing',
        text: 'You need an account to list a sale, so buyers know it\'s genuine and you can manage it later. It only takes a minute to sign up.',
    },
    SavedListings: {
        icon: Heart,
        title: 'Sign in to see your Favourites',
        text: 'Sign in to save the sales you like and find them again here, on any device.',
    },
};

// Shown to someone signed out who taps Create Listing or Favourites, instead of sending them
// straight to the login page.
export default function SignInPromptDialog({ page, onClose }) {
    const message = MESSAGES[page];
    if (!message) return null;
    const Icon = message.icon;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
                <DialogHeader className="items-center text-center sm:text-center">
                    <div className="w-12 h-12 rounded-full bg-brand-orange/15 text-brand-orange-dark flex items-center justify-center mb-2">
                        <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <DialogTitle className="text-navy">{message.title}</DialogTitle>
                    <DialogDescription className="pt-1 text-slate-600">{message.text}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-center">
                    <Button variant="outline" onClick={onClose}>Not now</Button>
                    <Button
                        className="bg-navy hover:bg-navy-dark text-white"
                        onClick={() => { window.location.href = '/login'; }}
                    >
                        <LogIn className="w-4 h-4 mr-2" aria-hidden="true" />
                        Sign Up / Log In
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
