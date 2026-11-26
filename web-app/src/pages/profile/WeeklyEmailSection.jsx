import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';

// The weekly sales email goes to sales within this distance (WEEKLY_RADIUS_KM in
// functions/lib/weeklyEmail.js).
export const WEEKLY_RADIUS_KM = 25;

// Profile > Weekly sales email: the on/off switch for the Friday email of sales near the user
// (functions/index.js sendWeeklySalesEmail). Everyone gets it until they turn it off here or with
// the unsubscribe link in the email.
export default function WeeklyEmailSection({ user, onChange }) {
    const [saving, setSaving] = useState(false);
    const on = user.weekly_email !== false;
    const hasArea = typeof user.area_lat === 'number';

    const toggle = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await firebase.auth.updateProfile({ weekly_email: !on });
            onChange({ weekly_email: !on });
            toast.success(on ? "You won't get the weekly sales email any more" : "You'll get the weekly sales email on Fridays");
        } catch (error) {
            toast.error('Could not change your email setting: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const area = user.suburb ? `of ${user.suburb}` : 'of your address';
    return (
        <section className="bg-brand-cream">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-slate-500" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 id="weekly-email-heading" className="text-lg font-semibold text-navy">Weekly sales email</h2>
                            <p className="text-sm text-slate-600">
                                Every Friday we email you the garage sales on that week within {WEEKLY_RADIUS_KM} km {area}.
                            </p>
                            {on && !hasArea && (
                                <p className="text-sm text-orange-700 mt-1">
                                    We couldn&apos;t find your address on the map yet, so this email can&apos;t be sent. Check your address with Edit Profile.
                                </p>
                            )}
                        </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer select-none shrink-0">
                        <span className="text-sm font-medium text-navy">{on ? 'On' : 'Off'}</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-labelledby="weekly-email-heading"
                            disabled={saving}
                            onClick={toggle}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy disabled:opacity-60 ${on ? 'bg-orange-600' : 'bg-slate-300'}`}
                        >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </label>
                </div>
            </div>
        </section>
    );
}
