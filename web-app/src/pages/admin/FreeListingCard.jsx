import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Calendar } from 'lucide-react';
import { toast } from "sonner";
import { format, parseISO } from 'date-fns';
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AU_DATE } from '@/lib/format';
import { isFreePeriodActive } from './adminStats';

const LOCAL_KEY = 'freeListingPeriod';

function readLocalFallback() {
    try {
        return localStorage.getItem(LOCAL_KEY);
    } catch {
        return null;
    }
}

export default function FreeListingCard({ appSettings }) {
    const queryClient = useQueryClient();
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (appSettings && Object.keys(appSettings).length > 0) {
            setStart(appSettings.free_listing_start || '');
            setEnd(appSettings.free_listing_end || '');
            setActive(appSettings.is_active || false);
        }
    }, [appSettings]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const settings = { free_listing_start: start, free_listing_end: end, is_active: active };
            try {
                const result = await firebase.entities.AppSettings.update({ ...settings, updated_at: new Date() });
                localStorage.removeItem(LOCAL_KEY);
                return result;
            } catch (firestoreError) {
                // Keep the admin's choice in this browser until Firestore accepts it.
                console.warn('Firestore save failed, using localStorage:', firestoreError.message);
                const fallback = { ...settings, updated_at: new Date().toISOString(), source: 'localStorage' };
                localStorage.setItem(LOCAL_KEY, JSON.stringify(fallback));
                return fallback;
            }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['appSettings'] });
            toast.success(`Free listing period saved${result.source === 'localStorage' ? ' (temporary - using browser storage)' : ''}`);
        },
        onError: (error) => {
            toast.error(`Failed to save settings: ${error.message}`);
        },
    });

    const handleSave = () => {
        if (active && (!start || !end)) {
            toast.error('Please set both start and end dates');
            return;
        }
        saveMutation.mutate();
    };

    const runningToday = isFreePeriodActive({ active, start, end });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Free Listing Period
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {readLocalFallback() && (
                    <Alert className="bg-amber-50 border-amber-200">
                        <AlertDescription className="text-amber-700 text-sm">
                            <strong>⚠️ Temporary storage:</strong> Settings are stored in browser. To make permanent, deploy Firestore rules to your Firebase project.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${runningToday ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <div>
                            <p className="font-medium text-[#1e3a5f]">Free Listings</p>
                            <p className="text-sm text-slate-500">
                                {runningToday
                                    ? 'Currently active - listings are FREE'
                                    : active
                                        ? 'Scheduled but not in date range'
                                        : 'Disabled - $10 per listing'}
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            aria-label="Enable free listings"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a5f]"></div>
                    </label>
                </div>

                {active && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="free-start" className="block text-sm font-medium text-slate-700 mb-1.5">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Start Date
                            </label>
                            <Input id="free-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full" />
                        </div>
                        <div>
                            <label htmlFor="free-end" className="block text-sm font-medium text-slate-700 mb-1.5">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                End Date
                            </label>
                            <Input id="free-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} min={start} className="w-full" />
                        </div>
                    </div>
                )}

                <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#152a45]">
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Settings
                </Button>

                {active && start && end && (
                    <div className={`p-4 rounded-xl border ${runningToday ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
                        <p className={`text-sm font-medium ${runningToday ? 'text-green-700' : 'text-[#1e3a5f]'}`}>
                            {runningToday ? '✅ FREE PERIOD ACTIVE TODAY!' : '⏳ Free period scheduled'}
                        </p>
                        <p className="text-sm mt-2">
                            <strong>Period:</strong> {format(parseISO(start), AU_DATE)} - {format(parseISO(end), AU_DATE)}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            During this period, all new listings will be published for $0.00 instead of $10.00
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
