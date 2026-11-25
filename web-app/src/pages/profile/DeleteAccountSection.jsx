import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export const CONFIRM_WORD = 'DELETE';

// Profile > Delete my account. Users can delete their own account and personal information
// (Privacy policy section 5; also needed for the App Store). The server only allows it within
// 10 minutes of signing in, so if the session is older the dialog offers a fresh sign-in.
export default function DeleteAccountSection({ onDeleted = () => { window.location.href = createPageUrl('Home'); } }) {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [needsSignIn, setNeedsSignIn] = useState(false);

    const close = (next) => {
        if (deleting) return;
        setOpen(next);
        if (!next) {
            setTyped('');
            setError('');
            setNeedsSignIn(false);
        }
    };

    const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

    const handleDelete = async (e) => {
        e.preventDefault();
        if (!confirmed) return;
        setDeleting(true);
        setError('');
        try {
            await firebase.entities.User.deleteMe();
            toast.success('Your account has been deleted.');
            onDeleted();
        } catch (err) {
            setNeedsSignIn(err?.code === 'app/recent-login-required');
            setError(err?.message || 'Your account could not be deleted. Please try again.');
            setDeleting(false);
        }
    };

    const signInAgain = async () => {
        await firebase.auth.logout();
        window.location.href = createPageUrl('Login');
    };

    return (
        <section className="bg-brand-cream">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-navy">Delete my account</h2>
                        <p className="text-sm text-slate-600">
                            Permanently remove your account, listings and personal details.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="gap-2 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => setOpen(true)}
                    >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        Delete my account
                    </Button>
                </div>
            </div>

            <Dialog open={open} onOpenChange={close}>
                <DialogContent className="sm:max-w-[460px]">
                    <form onSubmit={handleDelete}>
                        <DialogHeader>
                            <DialogTitle>Delete your account?</DialogTitle>
                            <DialogDescription>This can&apos;t be undone.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-4 text-sm text-slate-700">
                            <p>We&apos;ll permanently delete:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>your sign-in and profile;</li>
                                <li>all your listings and their photos, including live ones;</li>
                                <li>your saved listings, sales records and contact messages.</li>
                            </ul>
                            <p>
                                Fees already paid for listings aren&apos;t refunded. Payment records are kept without
                                your name or email, because we must keep financial records by law.
                            </p>

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</Label>
                                <Input
                                    id="delete-confirm"
                                    value={typed}
                                    onChange={(e) => setTyped(e.target.value)}
                                    autoComplete="off"
                                    disabled={deleting}
                                />
                            </div>

                            {error && (
                                <p role="alert" className="text-red-700">{error}</p>
                            )}
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => close(false)} disabled={deleting}>
                                Cancel
                            </Button>
                            {needsSignIn ? (
                                <Button type="button" className="bg-navy hover:bg-navy-dark" onClick={signInAgain}>
                                    Sign out and sign in again
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    className="bg-red-700 hover:bg-red-800 text-white"
                                    disabled={!confirmed || deleting}
                                >
                                    {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Delete my account
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
