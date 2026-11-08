import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { formatAud } from '@/lib/format';
import { LISTING_STATUS } from '@/lib/listings';
import ListingEditRow from './ListingEditRow';
import ListingRow from './ListingRow';
import { ADMIN_KEY, usePagedQuery, LoadMoreButton, ListLoading } from './usePagedQuery';

const errorText = (error) => error.message || error.code || 'Unknown error';

function ReasonDialog({ open, title, description, subjectLabel, subject, confirmLabel, pending, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const close = () => {
        setReason('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div>
                        <p className="text-sm text-slate-500 mb-2">
                            {subjectLabel}: <strong>{subject}</strong>
                        </p>
                        <Textarea
                            placeholder="Enter reason..."
                            aria-label="Reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={close} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onConfirm(reason, close)}
                            disabled={!reason.trim() || pending}
                            className="flex-1 bg-red-500 hover:bg-red-600"
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ApprovalTab() {
    const queryClient = useQueryClient();
    const [listingToReject, setListingToReject] = useState(null);
    const [editToRefuse, setEditToRefuse] = useState(null);
    const paged = usePagedQuery(['listings', 'pending'], (cursor) =>
        firebase.entities.GarageSale.page({ status: LISTING_STATUS.PENDING_APPROVAL, cursor }));
    const pendingListings = paged.items;

    const pagedEdits = usePagedQuery(['listingEdits'], (cursor) => firebase.entities.ListingEdit.page({ cursor }));
    const editIds = pagedEdits.items.map((edit) => edit.id);
    const { data: editedListings = [] } = useQuery({
        queryKey: [ADMIN_KEY, 'editedListings', editIds.join(',')],
        queryFn: () => firebase.entities.GarageSale.getByIds(editIds),
        enabled: editIds.length > 0,
    });
    // An edit only applies while its listing is live.
    const edits = pagedEdits.items
        .map((edit) => ({ edit, listing: editedListings.find((listing) => listing.id === edit.id) }))
        .filter(({ listing }) => listing?.status === LISTING_STATUS.ACTIVE);

    const notifyApproved = async (saleId, userId) => {
        // The approval stands even if the notification email fails.
        if (!userId) return;
        try {
            await firebase.functions.invoke('sendApprovalEmail', { saleId });
        } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
        }
    };

    const approveMutation = useMutation({
        mutationFn: async (listing) => {
            const result = await firebase.entities.GarageSale.update(listing.id, { status: LISTING_STATUS.ACTIVE });
            await notifyApproved(listing.id, listing.user_id);
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
        mutationFn: ({ listingId, reason }) => firebase.entities.GarageSale.reject(listingId, reason),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            toast.success(result?.refunded
                ? `Listing rejected and ${formatAud(result.refunded, { withCode: true })} refunded`
                : 'Listing rejected');
            if (!result?.emailed) {
                toast.warning("The seller couldn't be emailed. They can still see the reason on their profile.");
            }
        },
        onError: (error) => {
            toast.error('Failed to reject listing: ' + errorText(error));
        },
    });

    const approveEditMutation = useMutation({
        mutationFn: async (edit) => {
            await firebase.entities.ListingEdit.approve(edit);
            await notifyApproved(edit.id, edit.user_id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            toast.success('Changes approved and live');
        },
        onError: (error) => {
            toast.error('Failed to approve changes: ' + errorText(error));
        },
    });

    const refuseEditMutation = useMutation({
        mutationFn: ({ saleId, reason }) => firebase.entities.ListingEdit.refuse(saleId, reason),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            toast.success('Changes refused. The listing stays live as it was.');
            if (!result?.emailed) {
                toast.warning("The seller couldn't be emailed. They can still see the reason on their profile.");
            }
        },
        onError: (error) => {
            toast.error('Failed to refuse changes: ' + errorText(error));
        },
    });

    const nothingWaiting = pendingListings.length === 0 && edits.length === 0;

    return (
        <>
            {paged.isLoading || pagedEdits.isLoading ? (
                <ListLoading />
            ) : nothingWaiting ? (
                <div className="text-center py-12 bg-white rounded-xl border">
                    <Check className="w-12 h-12 text-green-300 mx-auto mb-4" />
                    <p className="text-slate-500">No pending listings</p>
                </div>
            ) : (
                <>
                    {edits.length > 0 && (
                        <>
                            <h3 className="font-semibold text-[#1e3a5f]">Edits to live listings</h3>
                            <p className="text-sm text-slate-500">Buyers keep seeing the current version until you approve.</p>
                            {edits.map(({ edit, listing }) => (
                                <ListingEditRow
                                    key={edit.id}
                                    listing={listing}
                                    edit={edit}
                                    onApprove={(e) => approveEditMutation.mutate(e)}
                                    onRefuse={setEditToRefuse}
                                    pending={approveEditMutation.isPending}
                                />
                            ))}
                            <LoadMoreButton paged={pagedEdits} />
                        </>
                    )}
                    {pendingListings.length > 0 && edits.length > 0 && (
                        <h3 className="font-semibold text-[#1e3a5f]">New listings</h3>
                    )}
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

            <ReasonDialog
                open={!!listingToReject}
                title="Reject Listing"
                description="Provide a reason for rejecting this listing. The seller sees this reason by email and on their profile. Any listing fee paid is refunded to them automatically."
                subjectLabel="Rejecting"
                subject={listingToReject?.title}
                confirmLabel="Reject"
                pending={rejectMutation.isPending}
                onClose={() => setListingToReject(null)}
                onConfirm={(reason, close) => rejectMutation.mutate({ listingId: listingToReject.id, reason }, { onSuccess: close })}
            />

            <ReasonDialog
                open={!!editToRefuse}
                title="Refuse Changes"
                description="Provide a reason for refusing these changes. The seller sees this reason by email and on their profile. The listing stays live as it is now, and no refund is made."
                subjectLabel="Refusing"
                subject={editToRefuse?.title}
                confirmLabel="Refuse"
                pending={refuseEditMutation.isPending}
                onClose={() => setEditToRefuse(null)}
                onConfirm={(reason, close) => refuseEditMutation.mutate({ saleId: editToRefuse.id, reason }, { onSuccess: close })}
            />
        </>
    );
}
