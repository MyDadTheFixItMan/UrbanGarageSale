import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

// "Have a free listing code?" on the listing form. Applying only checks the code; it is used up
// when the listing is published (CreateListing redeems it once the listing is saved).
export default function FreeCodeSection({ applied, onApply, onRemove }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [checking, setChecking] = useState(false);

    const apply = async () => {
        if (!value.trim()) {
            toast.error('Please enter your free listing code');
            return;
        }
        setChecking(true);
        try {
            const result = await firebase.entities.FreeListingCode.check(value);
            onApply(result.code);
            setValue('');
            toast.success('Code applied: this listing is free');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setChecking(false);
        }
    };

    if (applied) {
        return (
            <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-700 font-medium flex flex-wrap items-center justify-between gap-2">
                    <span>🎟️ Code {applied} applied! Your listing is FREE and will go live once it's approved.</span>
                    <button type="button" onClick={onRemove} className="text-sm underline">
                        Remove code
                    </button>
                </AlertDescription>
            </Alert>
        );
    }

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-navy underline">
                Have a free listing code?
            </button>
        );
    }

    return (
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <label htmlFor="free-listing-code" className="block text-sm font-medium text-slate-700">
                Free listing code
            </label>
            <div className="flex gap-2">
                <Input
                    id="free-listing-code"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            apply();
                        }
                    }}
                    placeholder="FREE-XXXX-XXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="flex-1 uppercase"
                />
                <Button type="button" variant="outline" onClick={apply} disabled={checking}>
                    {checking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Apply
                </Button>
            </div>
            <p className="text-xs text-slate-500">The code is used up when you publish this listing.</p>
        </div>
    );
}
