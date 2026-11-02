import React from 'react';
import { Input } from '@/components/ui/input';

// The suburb, state and postcode of the address above, filled in when a suggestion is picked.
export default function AddressParts({ suburb, state, postcode }) {
    return (
        <div className="grid grid-cols-3 gap-3 mt-3">
            <Input aria-label="Suburb" value={suburb || ''} placeholder="Suburb" readOnly />
            <Input aria-label="State" value={state || ''} placeholder="State" readOnly />
            <Input aria-label="Postcode" value={postcode || ''} placeholder="Postcode" readOnly />
        </div>
    );
}
