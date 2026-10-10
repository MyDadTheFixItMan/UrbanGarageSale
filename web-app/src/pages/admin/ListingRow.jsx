import React, { useRef } from 'react';
import { Tag, Check, X, Eye, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from '../../utils';
import { AU_DATE } from '@/lib/format';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
    pending_approval: { label: 'Pending Admin Approval', color: 'bg-blue-100 text-blue-700' },
    active: { label: 'Listing Approved', color: 'bg-green-100 text-green-700' },
    completed: { label: 'Completed', color: 'bg-slate-100 text-slate-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

// Runs the handler once per click; repeat clicks within 500ms are ignored.
function useSingleClick(handler) {
    const busy = useRef(false);
    return (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy.current) return;
        busy.current = true;
        handler();
        setTimeout(() => { busy.current = false; }, 500);
    };
}

function stopAnd(handler) {
    return (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
    };
}

export default function ListingRow({ listing, overrideStatus = null, onApprove, onReject, onDelete }) {
    const displayStatus = overrideStatus || listing.status;
    const handleApprove = useSingleClick(() => onApprove(listing));
    const handleReject = useSingleClick(() => onReject(listing));
    const handleView = stopAnd(() => {
        window.location.href = createPageUrl(`ListingDetails?id=${listing.id}`);
    });

    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-white rounded-xl border hover:border-slate-300">
            <div className="flex items-start md:items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                    {listing.photos && listing.photos.length > 0 ? (
                        <img
                            src={listing.photos[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Tag className="w-5 h-5 text-slate-300" />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-[#1e3a5f] break-words">{listing.title}</h4>
                    <p className="text-sm text-slate-500 break-words">
                        📍 {listing.address} • {listing.suburb} {listing.postcode} {listing.state}
                    </p>
                    <p className="text-sm text-slate-500 break-words">
                        📅 {listing.start_date ? format(parseISO(listing.start_date), AU_DATE) : 'No date'}{listing.start_time && ` ${listing.start_time}`}{listing.end_time && ` - ${listing.end_time}`}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <Badge className={`${statusConfig[displayStatus]?.color} transition-none whitespace-nowrap`}>
                    {statusConfig[displayStatus]?.label}
                </Badge>
                {onApprove && onReject && listing.status === 'pending_approval' && (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 transition-none"
                            onMouseDown={handleApprove}
                            aria-label="Approve listing"
                        >
                            <Check className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 transition-none"
                            onMouseDown={handleReject}
                            aria-label="Reject listing"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </>
                )}
                {onDelete && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 transition-none"
                        onMouseDown={stopAnd(() => onDelete(listing))}
                        aria-label="Delete listing"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
                <Button size="sm" variant="ghost" className="transition-none" onMouseDown={handleView} aria-label="View listing details">
                    <Eye className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
