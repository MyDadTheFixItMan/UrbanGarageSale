import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Calendar } from 'lucide-react';
import { toast } from "sonner";
import { format, parseISO } from 'date-fns';
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AU_DATE, formatAud } from '@/lib/format';
import { LISTING_FEE_AUD } from '@/lib/pricing';
import { STATES } from '../createListing/listingForm';
import {
    ALL_STATES_PERIOD, isFreePeriodActive, freePeriodsFromSettings, freePeriodsToSettings, freePeriodProblem,
} from './adminStats';

const STATE_CODES = STATES.map(([code]) => code);
const PERIOD_NAMES = { [ALL_STATES_PERIOD]: 'All of Australia', ...Object.fromEntries(STATES) };

const dateLabel = (value) => format(parseISO(value), AU_DATE);

function periodStatus(period) {
    if (!period.active) return 'Off';
    if (!period.start || !period.end) return 'Choose a start and end date';
    const dates = `${dateLabel(period.start)} – ${dateLabel(period.end)}`;
    if (isFreePeriodActive(period)) return `Free now · ${dates}`;
    return period.end < format(new Date(), 'yyyy-MM-dd') ? `Finished · ${dates}` : `Scheduled · ${dates}`;
}

// One period's on/off switch and dates.
function PeriodRow({ id, name, period, onChange }) {
    const runningToday = isFreePeriodActive(period);
    let dot = 'bg-slate-300';
    if (runningToday) dot = 'bg-green-500';
    else if (period.active) dot = 'bg-blue-400';

    return (
        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3 h-3 shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0">
                        <p className="font-medium text-navy">{name}</p>
                        <p className="text-sm text-slate-500">{periodStatus(period)}</p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        aria-label={`Free listings: ${name}`}
                        checked={period.active}
                        onChange={(e) => onChange({ ...period, active: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy"></div>
                </label>
            </div>

            {period.active && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor={`${id}-start`} className="block text-sm font-medium text-slate-700 mb-1.5">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Start Date
                        </label>
                        <Input
                            id={`${id}-start`}
                            type="date"
                            value={period.start}
                            onChange={(e) => onChange({ ...period, start: e.target.value })}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label htmlFor={`${id}-end`} className="block text-sm font-medium text-slate-700 mb-1.5">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            End Date
                        </label>
                        <Input
                            id={`${id}-end`}
                            type="date"
                            value={period.end}
                            min={period.start || undefined}
                            onChange={(e) => onChange({ ...period, end: e.target.value })}
                            className="w-full"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Free listing periods for all of Australia and for each state. A listing is free when its sale
// starts inside a period that is on for all of Australia or for the listing's state
// (isFreeListing() in firestore.rules decides).
export default function FreeListingCard({ appSettings }) {
    const queryClient = useQueryClient();
    const [periods, setPeriods] = useState(() => freePeriodsFromSettings({}, STATE_CODES));

    useEffect(() => {
        if (appSettings) setPeriods(freePeriodsFromSettings(appSettings, STATE_CODES));
    }, [appSettings]);

    const setPeriod = (key) => (period) => setPeriods((current) => ({ ...current, [key]: period }));

    const saveMutation = useMutation({
        mutationFn: () => firebase.entities.AppSettings.update({
            ...freePeriodsToSettings(periods, STATE_CODES),
            updated_at: new Date(),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appSettings'] });
            toast.success('Free listing periods saved');
        },
        onError: (error) => {
            toast.error(`Failed to save settings: ${error.message}`);
        },
    });

    const handleSave = () => {
        for (const key of [ALL_STATES_PERIOD, ...STATE_CODES]) {
            const problem = freePeriodProblem(periods[key]);
            if (problem) {
                toast.error(`${PERIOD_NAMES[key]} ${problem}`);
                return;
            }
        }
        saveMutation.mutate();
    };

    const freeToday = useMemo(
        () => [ALL_STATES_PERIOD, ...STATE_CODES].filter((key) => isFreePeriodActive(periods[key])),
        [periods]
    );
    let todaySummary = `Not free anywhere today: listings are ${formatAud(LISTING_FEE_AUD)} each.`;
    if (freeToday.includes(ALL_STATES_PERIOD)) todaySummary = 'Listings are FREE everywhere today.';
    else if (freeToday.length > 0) todaySummary = `Listings are FREE today in ${freeToday.join(', ')}.`;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Free Listing Periods
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <p className="text-sm text-slate-600">
                        A new listing is free when its sale starts inside a period that is switched on, either for all of
                        Australia or for the state the sale is in. Free listings still wait for approval.
                    </p>
                    <p className={`text-sm font-medium ${freeToday.length > 0 ? 'text-green-700' : 'text-slate-500'}`}>
                        {todaySummary}
                    </p>
                </div>

                <PeriodRow
                    id="free-all"
                    name={PERIOD_NAMES[ALL_STATES_PERIOD]}
                    period={periods[ALL_STATES_PERIOD]}
                    onChange={setPeriod(ALL_STATES_PERIOD)}
                />

                <div className="space-y-3">
                    <p className="font-medium text-navy">By state</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {STATE_CODES.map((code) => (
                            <PeriodRow
                                key={code}
                                id={`free-${code.toLowerCase()}`}
                                name={PERIOD_NAMES[code]}
                                period={periods[code]}
                                onChange={setPeriod(code)}
                            />
                        ))}
                    </div>
                </div>

                <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-navy hover:bg-navy-dark">
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Settings
                </Button>
            </CardContent>
        </Card>
    );
}
