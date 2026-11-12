import React from 'react';
import { SALE_TYPE_LABELS } from '@/lib/listings';

// Fills the photo spot for listings without a photo: the logo's houses on a soft orange tint, with the sale
// type underneath when there's room. Sized by its container.
export default function ListingPlaceholder({ saleType, compact = false, className = '' }) {
    return (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-brand-orange/10 ${className}`}>
            <img
                src="/logo-mark.webp"
                alt=""
                width="156"
                height="160"
                className={`${compact ? 'h-1/2' : 'h-2/5 max-h-28'} w-auto opacity-40`}
            />
            {!compact && saleType && SALE_TYPE_LABELS[saleType] && (
                <span className="text-sm font-semibold text-navy/60">{SALE_TYPE_LABELS[saleType]}</span>
            )}
        </div>
    );
}
