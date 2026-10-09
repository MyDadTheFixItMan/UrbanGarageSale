import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import ListingRow from './ListingRow';
import { ADMIN_KEY, usePagedQuery, LoadMoreButton, ListLoading } from './usePagedQuery';

const errorText = (error) => error.message || error.code || 'Unknown error';

export default function ApprovalTab() {
    const queryClient = useQueryClient();
    const [listingToReject, setListingToReject] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const paged = usePagedQuery(['listings', 'pending'], (cursor) =>
        firebase.entities.GarageSale.page({ status: 'pending_approval', cursor }));
    const pendingListings = paged.items;

    const approveMutation = useMutation({
        mutationFn: async (listing) => {
            const result = await firebase.entities.GarageSale.update(listing.id, { status: 'active' });
            // The approval stands even if the notification email fails.
            if (listing.user_id) {
                try {
                    await firebase.functions.invoke('sendApprovalEmail', { saleId: listing.id });
                } catch (emailError) {
                    console.error('Failed to send approval email:', emailError);
                }
            }
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            toast.success('Listing approved and notification sent');
        },
        onError: (error) => {
            toast.error('Failed to approve listing: ' + errorText(error));
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ listingId, reason }) => firebase.entities.GarageSale.update(listingId, {
            status: 'rejected',
            rejection_reason: reason,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            setListingToReject(null);
            setRejectionReason('');
            toast.success('Listing rejected');
        },
        onError: (error) => {
            toast.error('Failed to reject listing: ' + errorText(error));
        },
    });

    return (
        <>
            {paged.isLoading ? (
                <ListLoading />
            ) : pendingListings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border">
                    <Check className="w-12 h-12 text-green-300 mx-auto mb-4" />
                    <p className="text-slate-500">No pending listings</p>
                </div>
            ) : (
                <>
                    {pendingListings.map((listing) => (
                        <ListingRow
                            key={listing.id}
                            listing={listing}
                            onApprove={(l) => approveMutation.mutate(l)}
                            onReject={setListingToReject}
                        />
                    ))}
                    <LoadMoreButton paged={paged} />
                </>
            )}

            <Dialog open={!!listingToReject} onOpenChange={() => setListingToReject(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Listing</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting this listing
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <p className="text-sm text-slate-500 mb-2">
                                Rejecting: <strong>{listingToReject?.title}</strong>
                            </p>
                            <Textarea
                                placeholder="Enter reason for rejection..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setListingToReject(null)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => rejectMutation.mutate({
                                    listingId: listingToReject.id,
                                    reason: rejectionReason,
                                })}
                                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                                className="flex-1 bg-red-500 hover:bg-red-600"
                            >
                                Reject
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
