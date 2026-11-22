import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export const REPORT_REASONS = [
    'Scam or fraud',
    'Not a real garage sale, or misleading',
    'Illegal, unsafe or offensive items',
    'Wrong address, dates or details',
    'Something else',
];

export const REPORT_DETAILS_MAX = 1000;

// The message an admin reads in Admin > Messages. Reports go through the same contact-message
// path as the Contact page, so they get its Firestore rules: signed in, verified email, one a minute.
export function reportMessage(listing, reason, details, origin) {
    const link = `${origin}${createPageUrl('ListingDetails')}?id=${encodeURIComponent(listing.id)}`;
    const place = [listing.suburb, listing.state, listing.postcode].filter(Boolean).join(' ');
    return [
        'LISTING REPORT',
        `Reason: ${reason}`,
        `Listing: ${listing.title || '(no title)'}${place ? ` (${place})` : ''}`,
        `Listing ID: ${listing.id}`,
        `Link: ${link}`,
        '',
        'Details:',
        details.trim() || '(none given)',
    ].join('\n');
}

// "Report this listing" link and dialog for listing pages. Sellers don't see it on their own listings.
export default function ReportListing({ listing, user }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [sending, setSending] = useState(false);

    if (!listing?.id || (user?.id && user.id === listing.user_id)) return null;

    if (!user) {
        return (
            <p className="text-sm text-slate-600 text-center">
                <Flag className="w-4 h-4 inline mr-1 -mt-0.5" aria-hidden="true" />
                Something wrong with this listing?{' '}
                <Link to={createPageUrl('Login')} className="text-navy underline">Sign in to report it</Link>
            </p>
        );
    }

    const close = (next) => {
        if (sending) return;
        setOpen(next);
        if (!next) {
            setReason('');
            setDetails('');
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!reason) {
            toast.error('Please choose a reason.');
            return;
        }
        setSending(true);
        try {
            await firebase.entities.ContactMessage.create({
                name: user.full_name || user.email || 'Signed-in user',
                message: reportMessage(listing, reason, details, window.location.origin),
            });
            toast.success('Thanks, we\'ve received your report and will look into it.');
            setSending(false);
            close(false);
        } catch (error) {
            toast.error(error?.message || 'Your report could not be sent. Please try again.');
            setSending(false);
        }
    };

    return (
        <>
            <div className="text-center">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="text-sm text-slate-600 hover:text-navy underline inline-flex items-center gap-1"
                >
                    <Flag className="w-4 h-4" aria-hidden="true" />
                    Report this listing
                </button>
            </div>

            <Dialog open={open} onOpenChange={close}>
                <DialogContent className="sm:max-w-[440px]">
                    <form onSubmit={submit}>
                        <DialogHeader>
                            <DialogTitle>Report this listing</DialogTitle>
                            <DialogDescription>
                                Tell us what&apos;s wrong. The seller isn&apos;t told who reported it.
                            </DialogDescription>
                        </DialogHeader>

                        <fieldset className="space-y-2 py-4">
                            <legend className="text-sm font-medium text-slate-700 mb-2">Reason</legend>
                            {REPORT_REASONS.map((r) => (
                                <label key={r} className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="radio"
                                        name="report-reason"
                                        value={r}
                                        checked={reason === r}
                                        onChange={() => setReason(r)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-slate-700">{r}</span>
                                </label>
                            ))}
                        </fieldset>

                        <div className="space-y-2 pb-4">
                            <Label htmlFor="report-details">Details (optional)</Label>
                            <Textarea
                                id="report-details"
                                value={details}
                                maxLength={REPORT_DETAILS_MAX}
                                onChange={(e) => setDetails(e.target.value)}
                                rows={4}
                                placeholder="For example, what the seller asked you to do"
                            />
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => close(false)} disabled={sending}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-navy hover:bg-navy-dark" disabled={sending}>
                                {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Send report
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
