import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { firebase } from '@/api/firebaseClient';
import { AU_STATES } from '@/api/firebase/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ADMIN_KEY } from './usePagedQuery';

function SummaryStat({ value, label }) {
    return (
        <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-[#1e3a5f]">{value ?? '–'}</p>
            <p className="text-sm text-slate-500">{label}</p>
        </div>
    );
}

// Charts and totals come from the dashboard's aggregate stats; postcodes are counted server-side.
export default function AnalyticsTab({ stats }) {
    const [selectedState, setSelectedState] = useState('all');
    const state = selectedState === 'all' ? null : selectedState;
    const { data: postcodes = [] } = useQuery({
        queryKey: [ADMIN_KEY, 'postcodes', selectedState],
        queryFn: () => firebase.entities.AdminStats.topPostcodes(state),
        staleTime: 1000 * 60 * 5,
    });

    const byState = (stats?.byState ?? []).filter((s) => s.users > 0 || s.listings > 0);
    const statesCovered = stats ? stats.byState.filter((s) => s.listings > 0).length : null;

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Users & Listings by State
                        </CardTitle>
                        <div className="flex gap-4 text-sm mt-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-red-500" />
                                <span className="text-slate-500">Users ({stats?.totalUsers ?? '–'})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-green-500" />
                                <span className="text-slate-500">Listings ({stats?.totalListings ?? '–'})</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byState}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="state" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="users" fill="#ef4444" name="Users" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="listings" fill="#22c55e" name="Listings" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Top Postcodes
                            </CardTitle>
                            <Select value={selectedState} onValueChange={setSelectedState}>
                                <SelectTrigger className="w-40" aria-label="Filter postcodes by state">
                                    <SelectValue placeholder="All States" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All States</SelectItem>
                                    {AU_STATES.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={postcodes}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Summary Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <SummaryStat value={stats?.totalListings} label="Total Listings" />
                        <SummaryStat value={stats?.activeListings} label="Active" />
                        <SummaryStat value={stats?.completedListings} label="Completed" />
                        <SummaryStat value={statesCovered} label="States Covered" />
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
