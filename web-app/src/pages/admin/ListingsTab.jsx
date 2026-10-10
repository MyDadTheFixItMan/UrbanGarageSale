import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ListingRow from './ListingRow';
import ConfirmDeleteDialog from './ConfirmDialog';
import { ADMIN_KEY, usePagedQuery, LoadMoreButton, ListLoading } from './usePagedQuery';

// Filter -> listing status queried (past listings are marked completed by the expireListings job),
// and the stats total shown for it.
const FILTERS = {
    all: { status: undefined, total: 'totalListings' },
    active: { status: 'active', total: 'activeListings' },
    draft: { status: 'draft', total: 'draftListings' },
    past: { status: 'completed', total: 'completedListings' },
};

export default function ListingsTab({ stats }) {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('all');
    const [selectedPast, setSelectedPast] = useState([]);
    const [listingToDelete, setListingToDelete] = useState(null);
    const { status, total } = FILTERS[filter];
    const paged = usePagedQuery(['listings', filter], (cursor) => firebase.entities.GarageSale.page({ status, cursor }));

    const deleteListingMutation = useMutation({
        mutationFn: (listingId) => firebase.entities.GarageSale.delete(listingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            setListingToDelete(null);
            toast.success('Listing deleted successfully');
        },
        onError: (error) => {
            toast.error('Failed to delete listing: ' + error.message);
        },
    });

    const deleteListingsMutation = useMutation({
        mutationFn: (listingIds) => Promise.all(listingIds.map((id) => firebase.entities.GarageSale.delete(id))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
            setSelectedPast([]);
            toast.success('Listings deleted');
        },
        onError: () => {
            toast.error('Failed to delete listings');
        },
    });

    const displayListings = paged.items;
    const isPast = filter === 'past';

    const toggleSelected = (id, checked) => {
        setSelectedPast((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle>All Listings ({stats ? stats[total] : displayListings.length})</CardTitle>
                    <div className="flex gap-2 items-center">
                        <Select value={filter} onValueChange={(value) => { setFilter(value); setSelectedPast([]); }}>
                            <SelectTrigger className="w-40" aria-label="Filter listings">
                                <SelectValue placeholder="Select filter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Listings</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="draft">Drafts</SelectItem>
                                <SelectItem value="past">Past</SelectItem>
                            </SelectContent>
                        </Select>
                        {isPast && selectedPast.length > 0 && (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    if (confirm(`Delete ${selectedPast.length} listing(s)?`)) {
                                        deleteListingsMutation.mutate(selectedPast);
                                    }
                                }}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete ({selectedPast.length})
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {paged.isLoading ? (
                    <ListLoading />
                ) : displayListings.length === 0 ? (
                    <div className="text-center py-12">
                        <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No listings found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayListings.map((listing) => (
                            <div key={listing.id} className="flex items-center gap-3">
                                {isPast && (
                                    <input
                                        type="checkbox"
                                        aria-label={`Select ${listing.title}`}
                                        checked={selectedPast.includes(listing.id)}
                                        onChange={(e) => toggleSelected(listing.id, e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300"
                                    />
                                )}
                                <div className="flex-1">
                                    <ListingRow
                                        listing={listing}
                                        onDelete={setListingToDelete}
                                        overrideStatus={isPast ? 'completed' : null}
                                    />
                                </div>
                            </div>
                        ))}
                        <LoadMoreButton paged={paged} />
                    </div>
                )}
            </CardContent>

            <ConfirmDeleteDialog
                open={!!listingToDelete}
                onClose={() => setListingToDelete(null)}
                title="Delete Listing"
                description="Permanently remove this listing from the system"
                itemName={listingToDelete?.title}
                onConfirm={() => deleteListingMutation.mutate(listingToDelete.id)}
                pending={deleteListingMutation.isPending}
            />
        </Card>
    );
}
