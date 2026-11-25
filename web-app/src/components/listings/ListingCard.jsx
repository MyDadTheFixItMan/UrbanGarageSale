import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CalendarClock } from 'lucide-react';
import { saleWhenLabel } from '@/lib/format';
import { coverImage, SALE_TYPE_LABELS } from '@/lib/listings';
import ListingPlaceholder from '@/components/listings/ListingPlaceholder';
import { listingPath } from '@/lib/seo/site';

// A sale's card, as the home page and Favourites show it: photo with the sale type, when, title
// and suburb, all linking to the listing. `action` sits over the photo's top right (the
// favourites heart); `children` go under the details, outside the link (e.g. buttons).
export default function ListingCard({ sale, distance = '', action = null, children = null }) {
    const when = saleWhenLabel(sale);
    return (
        <div className="relative h-full flex flex-col bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
            <Link to={listingPath(sale)} className="block flex-1">
                <div className="aspect-video relative">
                    {coverImage(sale) ? (
                        <img src={coverImage(sale)} alt={sale.title} className="w-full h-full object-cover" />
                    ) : (
                        <ListingPlaceholder />
                    )}
                    <span className="absolute bottom-3 left-3 text-xs font-semibold bg-white/95 text-navy px-3 py-1 rounded-full shadow-sm">
                        {SALE_TYPE_LABELS[sale.sale_type] ?? 'Sale'}
                    </span>
                </div>
                <div className="p-4">
                    {when && (
                        <p className="flex items-center gap-1.5 text-sm font-bold text-brand-orange-dark mb-1">
                            <CalendarClock className="w-4 h-4 flex-shrink-0" />
                            {when}
                        </p>
                    )}
                    <h3 className="text-lg font-bold text-navy leading-snug mb-1 line-clamp-2">{sale.title}</h3>
                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
                        <span>
                            <span className="font-semibold">{sale.suburb || sale.postcode}</span>
                            {distance && <span> · {distance}</span>}
                        </span>
                    </p>
                </div>
            </Link>
            {children && <div className="px-4 pb-4">{children}</div>}
            {action && <div className="absolute top-3 right-3 z-40">{action}</div>}
        </div>
    );
}
