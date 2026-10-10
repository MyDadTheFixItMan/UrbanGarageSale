import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';
import { Shield, Loader2, Tag, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { createPageUrl } from '../utils';
import { formatAud } from '@/lib/format';
import { ADMIN_KEY } from './admin/usePagedQuery';
import ListingsTab from './admin/ListingsTab';
import ApprovalTab from './admin/ApprovalTab';
import AnalyticsTab from './admin/AnalyticsTab';
import UsersTab from './admin/UsersTab';
import PaymentsTab from './admin/PaymentsTab';
import PromotionsCard from './admin/PromotionsCard';
import FreeListingCard from './admin/FreeListingCard';
import MessagesTab from './admin/MessagesTab';

function StatCard({ title, value, icon: Icon, color = "bg-[#102a43]" }) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <p className="text-3xl font-bold text-[#1e3a5f] mt-2">{value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-10 flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Swallows a fetch error so one failing collection doesn't blank the whole dashboard.
const orEmpty = (label, fallback) => (fn) => async () => {
    try {
        return await fn();
    } catch (error) {
        console.error(`Error fetching ${label}:`, error);
        return fallback;
    }
};

// Signs out of the page unless the user is an admin whose session passed SMS 2FA.
function useAdminUser() {
    const [user, setUser] = useState(null);
    useEffect(() => {
        const init = async () => {
            if (!(await firebase.auth.isAuthenticated())) {
                window.location.href = '/login';
                return;
            }
            const userData = await firebase.auth.me();
            if (userData.role !== 'admin') {
                window.location.href = createPageUrl('Home');
                return;
            }
            // Admin data is only released to sessions that passed SMS 2FA (firestore.rules).
            if (!(await firebase.auth.hasSecondFactorSession())) {
                toast.error('Admin access requires two-factor authentication. Turn on 2FA in your Profile, then sign in again.');
                window.location.href = createPageUrl('Profile');
                return;
            }
            setUser(userData);
        };
        init();
    }, []);
    return user;
}

function usePromoRotation(count) {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        if (count === 0) return;
        const interval = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
        return () => clearInterval(interval);
    }, [count]);
    return index;
}

export default function AdminDashboard() {
    const user = useAdminUser();
    const isAdmin = user?.role === 'admin';
    const [activeTab, setActiveTab] = useState('listings');

    const { data: allPromotions = [] } = useQuery({
        queryKey: ['allPromotions'],
        queryFn: orEmpty('promotions', [])(() => firebase.firestore.collection('promotions').getDocs('sequence', 'asc')),
        enabled: isAdmin,
        staleTime: 1000 * 60 * 5,
    });
    // Counts and totals only; each tab loads its own records a page at a time when opened.
    const { data: stats = null } = useQuery({
        queryKey: [ADMIN_KEY, 'stats'],
        queryFn: orEmpty('admin stats', null)(() => firebase.entities.AdminStats.get()),
        enabled: isAdmin,
    });
    const { data: appSettings = null } = useQuery({
        queryKey: ['appSettings'],
        queryFn: orEmpty('app settings', {})(async () => (await firebase.entities.AppSettings.get()) || {}),
        enabled: isAdmin,
    });

    const promoIndex = usePromoRotation(allPromotions.length);

    const statValue = (value, format = (v) => v) => (stats ? format(value) : '–');
    const unreadCount = stats?.unreadMessages ?? 0;
    const pendingCount = stats?.pendingListings ?? 0;

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f5f1e8' }} className="min-h-screen overflow-hidden pb-24 md:pb-0">
            {/* Watermark */}
            <style>{`
                @media (min-width: 768px) {
                    .watermark-page {
                        top: -90px !important;
                    }
                }
            `}</style>
            <img
                src="/Logo Webpage.png"
                alt=""
                className="fixed left-0 pointer-events-none watermark-page"
                style={{
                    width: '1200px',
                    height: 'auto',
                    clipPath: 'polygon(0 0, 46% 0, 46% 100%, 0 100%)',
                    top: '60px',
                    zIndex: 5,
                    opacity: 0.35,
                    objectFit: 'contain'
                }}
            />

            {/* Advertising Ribbon */}
            {allPromotions.length > 0 && (
                <div className="bg-gradient-to-r from-[#FF9500] to-[#f97316] text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full" style={{ backgroundColor: 'rgb(255, 149, 0)' }}>
                    <p className="text-sm sm:text-base font-semibold">
                        {allPromotions[promoIndex]?.message}
                    </p>
                </div>
            )}

            <section className="relative bg-[#f5f1e8] py-16 px-4 sm:px-6 overflow-hidden">
                <div className="max-w-7xl mx-auto pt-2 md:pt-4 relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e3a5f]">Admin Dashboard</h1>
                            <p className="text-slate-500">Manage listings and view analytics</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 -mb-16">
                        <StatCard title="Active Listings" value={statValue(stats?.activeListings)} icon={Tag} color="bg-green-500" />
                        <StatCard title="Pending Approval" value={statValue(pendingCount)} icon={Clock} color="bg-yellow-500" />
                        <StatCard title="Monthly Revenue" value={statValue(stats?.monthlyRevenue, formatAud)} icon={DollarSign} color="bg-[#1e3a5f]" />
                        <StatCard title="Total Revenue" value={statValue(stats?.totalRevenue, formatAud)} icon={TrendingUp} color="bg-purple-500" />
                    </div>
                </div>
            </section>

            <section className="relative bg-[#f5f1e8]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 py-8 mt-4 sm:mt-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="bg-white border border-slate-200 rounded-lg p-1 w-full justify-start overflow-x-auto md:overflow-visible md:flex-wrap">
                            <TabsTrigger value="listings" className="text-xs md:text-sm whitespace-nowrap">Listings</TabsTrigger>
                            <TabsTrigger value="pending" className="relative flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
                                <span className="hidden sm:inline">Listing Approval</span>
                                <span className="sm:hidden">Approval</span>
                                {pendingCount > 0 && <Badge className="bg-yellow-500 text-white text-xs">{pendingCount}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="analytics" className="text-xs md:text-sm whitespace-nowrap">Analytics</TabsTrigger>
                            <TabsTrigger value="users" className="text-xs md:text-sm whitespace-nowrap">Users</TabsTrigger>
                            <TabsTrigger value="payments" className="text-xs md:text-sm whitespace-nowrap">Payments</TabsTrigger>
                            <TabsTrigger value="messages" className="relative flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
                                <span className="hidden sm:inline">Messages</span>
                                <span className="sm:hidden">Msgs</span>
                                {unreadCount > 0 && <Badge className="bg-blue-500 text-white text-xs">{unreadCount}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="settings" className="text-xs md:text-sm whitespace-nowrap">Settings</TabsTrigger>
                        </TabsList>

                        <TabsContent value="listings" className="space-y-4">
                            <ListingsTab stats={stats} />
                        </TabsContent>
                        <TabsContent value="pending" className="space-y-4">
                            <ApprovalTab />
                        </TabsContent>
                        <TabsContent value="analytics" className="space-y-6">
                            <AnalyticsTab stats={stats} />
                        </TabsContent>
                        <TabsContent value="users" className="space-y-4">
                            <UsersTab currentUserEmail={user.email} />
                        </TabsContent>
                        <TabsContent value="payments" className="space-y-4">
                            <PaymentsTab />
                        </TabsContent>
                        <TabsContent value="settings" className="space-y-4">
                            <PromotionsCard promotions={allPromotions} />
                            <FreeListingCard appSettings={appSettings} />
                        </TabsContent>
                        <TabsContent value="messages" className="space-y-4">
                            <MessagesTab currentUserEmail={user.email} />
                        </TabsContent>
                    </Tabs>
                </div>
            </section>
        </div>
    );
}
