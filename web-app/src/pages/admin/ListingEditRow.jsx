import React from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SALE_TYPES } from '../createListing/listingForm';

const saleTypeLabel = (type) => SALE_TYPES.find(([value]) => value === type)?.[1] || type;

function Change({ label, from, to }) {
    return (
        <div className="text-sm">
            <p className="font-medium text-slate-700">{label}</p>
            <p className="text-slate-500 line-through whitespace-pre-line break-words">{from || 'None'}</p>
            <p className="text-navy whitespace-pre-line break-words">{to || 'None'}</p>
        </div>
    );
}

function Photos({ label, photos = [] }) {
    return (
        <div>
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <div className="flex flex-wrap gap-2">
                {photos.length === 0 && <p className="text-sm text-slate-400">No photos</p>}
                {photos.map((photo) => (
                    <img key={photo} src={photo} alt="" className="w-16 h-16 rounded object-cover" />
                ))}
            </div>
        </div>
    );
}

// A seller's proposed changes to a live listing, shown against what buyers see now.
export default function ListingEditRow({ listing, edit, onApprove, onRefuse, pending }) {
    const photosChanged = JSON.stringify(listing.photos ?? []) !== JSON.stringify(edit.photos ?? []);

    return (
        <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="font-medium text-navy break-words">{listing.title}</h4>
                    <p className="text-sm text-slate-500 break-words">
                        📍 {listing.address} • {listing.suburb} {listing.postcode} {listing.state}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge className="bg-amber-100 text-amber-800 transition-none whitespace-nowrap">Edited</Badge>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 transition-none"
                        onClick={() => onApprove(edit)}
                        disabled={pending}
                        aria-label="Approve changes"
                    >
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 transition-none"
                        onClick={() => onRefuse(edit)}
                        disabled={pending}
                        aria-label="Refuse changes"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-3 border-t pt-3">
                {listing.title !== edit.title && <Change label="Title" from={listing.title} to={edit.title} />}
                {(listing.description ?? '') !== (edit.description ?? '') && (
                    <Change label="Description" from={listing.description} to={edit.description} />
                )}
                {listing.sale_type !== edit.sale_type && (
                    <Change label="Sale type" from={saleTypeLabel(listing.sale_type)} to={saleTypeLabel(edit.sale_type)} />
                )}
                {photosChanged && (
                    <div className="text-sm space-y-2">
                        <p className="font-medium text-slate-700">Photos</p>
                        <Photos label="Now" photos={listing.photos} />
                        <Photos label="Proposed" photos={edit.photos} />
                    </div>
                )}
            </div>
        </div>
    );
}
