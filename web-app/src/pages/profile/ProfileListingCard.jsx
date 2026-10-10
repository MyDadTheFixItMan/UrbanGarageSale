import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Tag, Trash2, Eye, Pencil, Printer } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatAud, AU_DATE } from '@/lib/format';
import { LISTING_FEE_AUD } from '@/lib/pricing';
import { createPageUrl } from '../../utils';
import { listingActions } from './profileListings';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
    pending_approval: { label: 'Pending Admin Approval', color: 'bg-blue-100 text-blue-700' },
    active: { label: 'Listing Approved', color: 'bg-green-100 text-green-700' },
    completed: { label: 'Completed', color: 'bg-slate-100 text-slate-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

export default function ProfileListingCard({ listing, onDelete, onPrint }) {
    const status = statusConfig[listing.status] || statusConfig.draft;
    const actions = listingActions(listing);

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="w-full aspect-video bg-slate-100 overflow-hidden rounded-t-lg">
                {listing.photos && listing.photos.length > 0 ? (
                    <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <Tag className="w-12 h-12 text-slate-400" />
                    </div>
                )}
            </div>

            <div className="p-5">
                <div className="mb-3">
                    <Badge className={`${status.color} rounded-full text-xs font-medium px-3 py-1`}>
                        {status.label}
                    </Badge>
                </div>

                <h3 className="font-bold text-[20px] text-slate-900 mb-2 line-clamp-2">{listing.title}</h3>

                <p className="text-sm font-medium text-slate-600 mb-2">
                    📅 {listing.start_date ? format(parseISO(listing.start_date), AU_DATE) : 'No date'}
                    {listing.start_time && ` — ${listing.start_time}`}{listing.end_time && ` to ${listing.end_time}`}
                </p>

                <p className="text-sm text-slate-500 mb-4">
                    📍 {listing.address && listing.suburb ? `${listing.address}, ${listing.suburb}` : listing.address || 'No address'}
                </p>

                <div className="flex gap-3">
                    {actions.view && (
                        <Link to={createPageUrl(`ListingDetails?id=${listing.id}`)} className="flex-1">
                            <Button size="sm" variant="outline" className="w-full h-9 text-sm font-medium">
                                <Eye className="w-4 h-4 mr-1.5" />
                                View
                            </Button>
                        </Link>
                    )}

                    {actions.edit && (
                        <Link to={createPageUrl(`CreateListing?edit=${listing.id}`)} className="flex-1">
                            <Button size="sm" variant="outline" className="w-full h-9 text-sm font-medium">
                                <Pencil className="w-4 h-4 mr-1.5" />
                                Edit
                            </Button>
                        </Link>
                    )}

                    {actions.pay && (
                        <Link to={createPageUrl(`Payment?id=${listing.id}`)} className="flex-1">
                            <Button size="sm" className="w-full h-9 text-sm font-medium bg-[#1e3a5f] hover:bg-[#152a45]">
                                Pay {formatAud(LISTING_FEE_AUD)}
                            </Button>
                        </Link>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-9 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete listing">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Listing?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your listing.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(listing.id)} className="bg-red-500 hover:bg-red-600">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {actions.print && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-2"
                            onClick={() => onPrint(listing)}
                            title="Print garage sale sign"
                            aria-label="Print garage sale sign"
                        >
                            <Printer className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
