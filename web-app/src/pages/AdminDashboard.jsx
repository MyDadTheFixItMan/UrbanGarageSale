import React, { useState, useEffect, useRef } from 'react';
import { firebase } from '@/api/firebaseClient';
import { localApi } from '@/lib/localApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Shield, Loader2, Tag, DollarSign, TrendingUp,
    Check, X, Eye, Clock, BarChart3, Settings, Calendar, Users,
    Trash2, ShieldCheck, Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isAfter, isBefore, startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
    pending_approval: { label: 'Pending Admin Approval', color: 'bg-blue-100 text-blue-700' },
    active: { label: 'Listing Approved', color: 'bg-green-100 text-green-700' },
    completed: { label: 'Completed', color: 'bg-slate-100 text-slate-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const CHART_COLORS = ['#1e3a5f', '#2d4a6f', '#3d5a7f', '#152a45', '#0f1f35', '#4d6a8f'];

export default function AdminDashboard() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [promoIndex, setPromoIndex] = useState(0);
    const [selectedListing, setSelectedListing] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [freeListingStart, setFreeListingStart] = useState('');
    const [freeListingEnd, setFreeListingEnd] = useState('');
    const [freeListingActive, setFreeListingActive] = useState(false);
    const [selectedState, setSelectedState] = useState('all');
    const [userStateFilter, setUserStateFilter] = useState('all');
    const [userPostcodeFilter, setUserPostcodeFilter] = useState('');
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToPromote, setUserToPromote] = useState(null);
    const [selectedUserDetails, setSelectedUserDetails] = useState(null);
    const [listingToDelete, setListingToDelete] = useState(null);
    const [listingsFilter, setListingsFilter] = useState('all');
    const [selectedPastListings, setSelectedPastListings] = useState([]);
    
    // Payment filters
    const [paymentDateFilter, setPaymentDateFilter] = useState('all');
    const [paymentSuburbFilter, setPaymentSuburbFilter] = useState('all');
    const [paymentStateFilter, setPaymentStateFilter] = useState('all');
    const [paymentListingData, setPaymentListingData] = useState({});
    const [activeTab, setActiveTab] = useState('listings');
    
    // Promotional Messages
    const [promoMessage, setPromoMessage] = useState('');
    const [showPromoInput, setShowPromoInput] = useState(false);
    const [editingPromoId, setEditingPromoId] = useState(null);

    // Contact message responses
    const [expandedMessageId, setExpandedMessageId] = useState(null);
    const [responseTexts, setResponseTexts] = useState({});
    const [messageFilter, setMessageFilter] = useState('all');
    const [incompleteUsers, setIncompleteUsers] = useState([]);

    useEffect(() => {
        const init = async () => {
            const authenticated = await firebase.auth.isAuthenticated();
            if (!authenticated) {
                window.location.href = '/login';
                return;
            }
            const userData = await firebase.auth.me();
            if (userData.role !== 'admin') {
                window.location.href = createPageUrl('Home');
                return;
            }
            setUser(userData);
            setLoading(false);
        };
        init();
    }, []);

    const { data: allPromotions = [], isLoading: promoLoading } = useQuery({
        queryKey: ['allPromotions'],
        queryFn: async () => {
            try {
                return await firebase.firestore.collection('promotions').getDocs('sequence', 'asc');
            } catch (error) {
                console.error('Error fetching promotions:', error);
                return [];
            }
        },
        enabled: !loading && user?.role === 'admin',
        staleTime: 1000 * 60 * 5,
    });

    // Rotate promotional messages every 5 seconds
    useEffect(() => {
        if (allPromotions.length === 0) return;
        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [allPromotions.length]);

    const savePromoMessageMutation = useMutation({
        mutationFn: async ({ message, sequence }) => {
            if (editingPromoId) {
                // Update existing
                const docRef = firebase.firestore.collection('promotions').doc(editingPromoId);
                await docRef.set({ message, sequence }, { merge: true });
            } else {
                // Create new
                const nextSequence = allPromotions.length > 0 
                    ? Math.max(...allPromotions.map(p => p.sequence || 0)) + 1
                    : 1;
                await firebase.firestore.collection('promotions').add({ message, sequence: nextSequence });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allPromotions'] });
            setPromoMessage('');
            setEditingPromoId(null);
            setShowPromoInput(false);
            toast.success('Promotional message saved!');
        },
        onError: (error) => {
            toast.error(`Failed to save message: ${error.message}`);
        },
    });

    const deletePromoMessageMutation = useMutation({
        mutationFn: async (promoId) => {
            const docRef = firebase.firestore.collection('promotions').doc(promoId);
            await docRef.delete();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allPromotions'] });
            toast.success('Promotional message deleted');
        },
    });

    const reorderPromoMessageMutation = useMutation({
        mutationFn: async ({ promoId, newSequence }) => {
            const docRef = firebase.firestore.collection('promotions').doc(promoId);
            await docRef.set({ sequence: newSequence }, { merge: true });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allPromotions'] });
        },
    });

    const { data: allListings = [], isLoading: listingsLoading } = useQuery({
        queryKey: ['allListings'],
        queryFn: () => firebase.entities.GarageSale.filter({ includePast: true }),
        enabled: !loading,
    });

    const { data: allPayments = [] } = useQuery({
        queryKey: ['allPayments'],
        queryFn: async () => {
            try {
                return await firebase.entities.Payment.filter();
            } catch (error) {
                console.error('Error fetching payments:', error);
                return [];
            }
        },
        enabled: !loading,
    });

    const { data: allUsers = [] } = useQuery({
        queryKey: ['allUsers'],
        queryFn: async () => {
            try {
                const users = await firebase.entities.User.filter();
                console.log('🔵 Raw users from Firestore:', users.length, 'users');
                
                // Log users without full_name
                const usersWithoutName = users.filter(u => !u.full_name || u.full_name.trim() === '');
                if (usersWithoutName.length > 0) {
                  console.warn(`⚠️ Users without full_name (will be hidden): ${usersWithoutName.length}`);
                  usersWithoutName.forEach((u, idx) => {
                    console.warn(`  ${idx + 1}. ID: ${u.id} | Email: ${u.email || '(no email)'} | Created: ${u.created_date || '(unknown)'}`);
                  });
                  // Store incomplete users for cleanup
                  setIncompleteUsers(usersWithoutName);
                } else {
                  setIncompleteUsers([]);
                }
                
                // Filter out incomplete/empty users (those without full_name)
                let filtered = users.filter(u => u.full_name && u.full_name.trim() !== '');
                console.log('✓ Filtered users (with full_name):', filtered.length, 'users');
                
                // Check for duplicate emails and warn about them
                const emailCounts = {};
                filtered.forEach(u => {
                  const email = u.email?.toLowerCase();
                  if (email) {
                    emailCounts[email] = (emailCounts[email] || 0) + 1;
                  }
                });
                
                const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
                if (duplicates.length > 0) {
                  console.warn(`⚠️ Found ${duplicates.length} email addresses with duplicate users:`, duplicates.map(d => `${d[0]} (${d[1]} users)`).join(', '));
                }
                
                console.log('✓ Final users for display:', filtered.length, 'users');
                return filtered;
            } catch (error) {
                console.error('Error fetching users:', error);
                return [];
            }
        },
        enabled: !loading && user?.role === 'admin',
    });

    const { data: appSettings = null } = useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            try {
                const settings = await firebase.entities.AppSettings.get();
                return settings || {};
            } catch (error) {
                console.error('Error fetching app settings:', error);
                return {};
            }
        },
        enabled: !loading,
    });

    const { data: contactMessages = [], isLoading: messagesLoading } = useQuery({
        queryKey: ['contactMessages'],
        queryFn: async () => {
            try {
                return await firebase.entities.ContactMessage.filter();
            } catch (error) {
                console.error('Error fetching contact messages:', error);
                return [];
            }
        },
        enabled: !loading && user?.role === 'admin',
    });

    useEffect(() => {
        if (appSettings && Object.keys(appSettings).length > 0) {
            setFreeListingStart(appSettings.free_listing_start || '');
            setFreeListingEnd(appSettings.free_listing_end || '');
            setFreeListingActive(appSettings.is_active || false);
        }
    }, [appSettings]);

    // Initialize test payment data if none exist
    useEffect(() => {
        const initializeTestData = async () => {
            if (loading || !user || user.role !== 'admin') {
                console.log('Waiting for admin auth...');
                return;
            }

            try {
                const payments = await firebase.entities.Payment.filter();
                console.log('Existing payments:', payments);
                
                // Check if there are any COMPLETED payments
                const completedPayments = payments.filter(p => p.status === 'completed');
                
                if (completedPayments.length === 0 && payments.length > 0) {
                    console.log('No completed payments found, updating first payment to completed...');
                    // Update the first payment to 'completed' for demo purposes
                    const firstPayment = payments[0];
                    if (firstPayment.id) {
                        await firebase.entities.Payment.update(firstPayment.id, {
                            status: 'completed',
                            amount: 49.99,
                        });
                        console.log('Payment updated to completed');
                        
                        // Invalidate queries to refresh
                        queryClient.invalidateQueries({ queryKey: ['allPayments'] });
                    }
                } else if (completedPayments.length === 0 && payments.length === 0) {
                    console.log('No payments found, creating test payment...');
                    // Create some test payments with 'completed' status
                    const result = await firebase.entities.Payment.create({
                        amount: 49.99,
                        status: 'completed',
                        payment_method: 'stripe',
                        transaction_id: 'test_stripe_' + Date.now(),
                    });
                    console.log('Test payment created:', result);
                    
                    // Invalidate queries to refresh
                    queryClient.invalidateQueries({ queryKey: ['allPayments'] });
                }
            } catch (error) {
                console.error('Error initializing test data:', error);
                // Silent fail
            }
        };
        
        initializeTestData();
    }, [loading, user, queryClient]);

    // Load listing data for payments
    useEffect(() => {
        const loadPaymentListingData = async () => {
            if (allPayments.length === 0) return;
            
            const data = {};
            const sales = await localApi.garage_sales.getAll();
            const users = await localApi.users.getAll();
            
            for (const payment of allPayments) {
                const sale = sales.find(s => s.id === payment.garage_sale_id);
                const paymentUser = users.find(u => u.email === payment.user_email);
                
                data[payment.id] = {
                    sale,
                    user: paymentUser,
                };
            }
            
            setPaymentListingData(data);
        };
        
        loadPaymentListingData();
    }, [allPayments]);

    // Auto-update listings that have passed their end date to 'completed'
    useEffect(() => {
        const updateExpiredListings = async () => {
            const now = startOfDay(new Date());
            for (const listing of allListings) {
                if (listing.status !== 'completed' && listing.end_date) {
                    const endDate = parseISO(listing.end_date);
                    if (isBefore(endDate, now)) {
                        // Update this listing to completed status
                        try {
                            await firebase.entities.GarageSale.update(listing.id, {
                                status: 'completed',
                            });
                        } catch (error) {
                            console.error(`Failed to update listing ${listing.id}:`, error);
                        }
                    }
                }
            }
            // Refetch after updates
            queryClient.invalidateQueries({ queryKey: ['allListings'] });
        };

        if (allListings.length > 0) {
            updateExpiredListings();
        }
    }, [allListings, queryClient]);

    const activeListings = allListings.filter(l => {
        if (l.status !== 'active') return false;
        // Only show active listings that have been paid for (or default to true for mock data)
        if (l.payment_status && l.payment_status !== 'paid') return false;
        // Exclude listings that have passed their end date
        if (l.end_date) {
            const endDate = parseISO(l.end_date);
            return !isBefore(endDate, startOfDay(new Date()));
        }
        return true;
    });
    const pendingListings = allListings.filter(l => l.status === 'pending_approval');
    const completedListings = allListings.filter(l => l.status === 'completed');
    const draftListings = allListings.filter(l => l.status === 'draft');
    const pastListings = allListings.filter(l => {
        if (l.status === 'completed') return true;
        if (l.end_date) {
            const endDate = parseISO(l.end_date);
            return isBefore(endDate, startOfDay(new Date()));
        }
        return false;
    });
    
    const thisMonthPayments = allPayments.filter(p => {
        let createdAt;
        if (p.created_at instanceof Date) {
            createdAt = p.created_at;
        } else if (p.created_at?.toDate) {
            // Firestore Timestamp object
            createdAt = p.created_at.toDate();
        } else if (typeof p.created_at === 'string') {
            createdAt = parseISO(p.created_at);
        } else {
            return false; // Skip if date can't be parsed
        }
        return isWithinInterval(createdAt, {
            start: startOfMonth(new Date()),
            end: endOfMonth(new Date()),
        });
    });

    const completedPayments = allPayments.filter(p => p.status === 'completed' && p.amount);

    const totalRevenue = allPayments
        .filter(p => p.status === 'completed' && p.amount)
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const monthlyRevenue = thisMonthPayments
        .filter(p => p.status === 'completed' && p.amount)
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Analytics data
    const listingsByState = allListings.reduce((acc, listing) => {
        const state = listing.state || 'Unknown';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
    }, {});

    const stateChartData = Object.entries(listingsByState).map(([name, value]) => ({
        name,
        value,
    }));

    const statesList = Object.keys(listingsByState).filter(s => s !== 'Unknown').sort();

    const filteredListingsForPostcode = selectedState === 'all' 
        ? allListings 
        : allListings.filter(l => l.state === selectedState);

    const listingsByPostcode = filteredListingsForPostcode.reduce((acc, listing) => {
        const postcode = listing.postcode || 'Unknown';
        acc[postcode] = (acc[postcode] || 0) + 1;
        return acc;
    }, {});

    const postcodeChartData = Object.entries(listingsByPostcode)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    // Users by state
    const usersByState = allUsers.reduce((acc, u) => {
        const state = u.state || 'Unknown';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
    }, {});

    const usersByStateChartData = Object.entries(usersByState).map(([name, value]) => ({
        name,
        value,
    }));

    // User states list for filter
    const userStatesList = Object.keys(usersByState).filter(s => s !== 'Unknown').sort();

    // Filter users
    const filteredUsers = allUsers.filter(u => {
        if (userStateFilter !== 'all' && u.state !== userStateFilter) return false;
        if (userPostcodeFilter && (!u.postcode || !u.postcode.includes(userPostcodeFilter))) return false;
        return true;
    });

    const approveMutation = useMutation({
        mutationFn: async (listingId) => {
            console.log('🟦 Approving listing:', listingId);
            try {
                // Get the listing to access creator email and title
                const listing = allListings.find(l => l.id === listingId);
                if (!listing) throw new Error('Listing not found');
                
                console.log('🟦 Calling firebase.entities.GarageSale.update()');
                const result = await firebase.entities.GarageSale.update(listingId, {
                    status: 'active',
                });
                console.log('🟦 Update returned:', result);
                
                // Send approval email to listing creator
                if (listing.created_by) {
                    try {
                        await firebase.functions.invoke('sendApprovalEmail', {
                            userEmail: listing.created_by,
                            listingTitle: listing.title,
                        });
                    } catch (emailError) {
                        console.error('⚠️  Failed to send approval email:', emailError);
                        // Don't fail the approval if email fails
                    }
                }
                
                return result;
            } catch (error) {
                console.error('🔴 Update failed immediately:', error.message);
                throw error;
            }
        },
        onSuccess: (result) => {
            console.log('🟢 Listing approved successfully:', result);
            queryClient.invalidateQueries({ queryKey: ['allListings'] });
            setSelectedListing(null);
            toast.success('Listing approved and notification sent');
        },
        onError: (error) => {
            console.error('🔴 Failed to approve listing:', error);
            console.error('🔴 Error message:', error.message);
            console.error('🔴 Error code:', error.code);
            toast.error('Failed to approve listing: ' + (error.message || error.code || 'Unknown error'));
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ listingId, reason }) => {
            console.log('🟦 Rejecting listing:', listingId, 'with reason:', reason);
            try {
                console.log('🟦 Calling firebase.entities.GarageSale.update()');
                const result = await firebase.entities.GarageSale.update(listingId, {
                    status: 'rejected',
                    rejection_reason: reason,
                });
                console.log('🟦 Update returned:', result);
                return result;
            } catch (error) {
                console.error('🔴 Update failed immediately:', error.message);
                throw error;
            }
        },
        onSuccess: () => {
            console.log('🟢 Listing rejected successfully');
            queryClient.invalidateQueries({ queryKey: ['allListings'] });
            setSelectedListing(null);
            setRejectionReason('');
            toast.success('Listing rejected');
        },
        onError: (error) => {
            console.error('🔴 Failed to reject listing:', error);
            console.error('🔴 Error message:', error.message);
            console.error('🔴 Error code:', error.code);
            toast.error('Failed to reject listing: ' + (error.message || error.code || 'Unknown error'));
        },
    });

    const grantFreeMutation = useMutation({
        mutationFn: async (listingId) => {
            await firebase.entities.GarageSale.update(listingId, {
                status: 'active',
                payment_status: 'free',
                is_free_listing: true,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allListings'] });
            toast.success('Free listing granted');
        },
    });

    const saveFreeListingPeriodMutation = useMutation({
        mutationFn: async ({ startDate, endDate, isActive }) => {
            console.log('💾 Saving free listing period:', { startDate, endDate, isActive });
            try {
                // Try to save to Firestore first
                const result = await firebase.entities.AppSettings.update({
                    free_listing_start: startDate,
                    free_listing_end: endDate,
                    is_active: isActive,
                    updated_at: new Date()
                });
                console.log('✓ Saved to Firestore:', result);
                // Clear localStorage if Firestore save succeeded
                localStorage.removeItem('freeListingPeriod');
                return result;
            } catch (firestoreError) {
                console.warn('⚠️ Firestore save failed, using localStorage:', firestoreError.message);
                // Fallback: save to localStorage
                const settingsData = {
                    free_listing_start: startDate,
                    free_listing_end: endDate,
                    is_active: isActive,
                    updated_at: new Date().toISOString(),
                    source: 'localStorage' // Mark as temporary
                };
                localStorage.setItem('freeListingPeriod', JSON.stringify(settingsData));
                console.log('✓ Saved to localStorage (temporary):', settingsData);
                return settingsData;
            }
        },
        onSuccess: (result) => {
            console.log('✓ Free listing period saved successfully');
            queryClient.invalidateQueries({ queryKey: ['appSettings'] });
            toast.success(`Free listing period saved${result.source === 'localStorage' ? ' (temporary - using browser storage)' : ''}`);
        },
        onError: (error) => {
            console.error('✗ Error saving free listing period:', error);
            toast.error(`Failed to save settings: ${error.message}`);
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (userId) => {
            try {
                console.log('🟦 Deleting user:', userId);
                const result = await firebase.entities.User.delete(userId);
                console.log('🟦 User deleted successfully:', result);
                return result;
            } catch (error) {
                console.error('🔴 Delete failed:', error.message);
                throw error;
            }
        },
        onSuccess: async () => {
            console.log('🟦 Delete onSuccess - invalidating and refetching allUsers query');
            // Invalidate and refetch to get fresh data
            await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            await queryClient.refetchQueries({ queryKey: ['allUsers'] });
            setUserToDelete(null);
            toast.success('User deleted successfully');
        },
        onError: (error) => {
            console.error('🔴 Delete mutation error:', error);
            toast.error('Failed to delete user: ' + error.message);
        },
    });

    const cleanupIncompleteUsersMutation = useMutation({
        mutationFn: async () => {
            if (incompleteUsers.length === 0) {
                throw new Error('No incomplete users to clean up');
            }
            console.log(`🧹 Cleaning up ${incompleteUsers.length} incomplete user(s)`);
            const results = await Promise.all(
                incompleteUsers.map(user => firebase.entities.User.delete(user.id))
            );
            console.log('✓ Cleanup completed:', results);
            return results;
        },
        onSuccess: async () => {
            console.log('✓ Cleanup successful - refreshing user list');
            await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            await queryClient.refetchQueries({ queryKey: ['allUsers'] });
            setIncompleteUsers([]);
            toast.success(`Successfully deleted ${incompleteUsers.length} incomplete user(s)`);
        },
        onError: (error) => {
            console.error('❌ Cleanup failed:', error);
            toast.error('Failed to clean up incomplete users: ' + error.message);
        },
    });

    const deleteListingMutation = useMutation({
        mutationFn: async (listingId) => {
            try {
                console.log('🟦 Deleting listing:', listingId);
                const result = await firebase.entities.GarageSale.delete(listingId);
                console.log('🟦 Listing deleted successfully:', result);
                return result;
            } catch (error) {
                console.error('🔴 Delete failed:', error.message);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allListings'] });
            setListingToDelete(null);
            toast.success('Listing deleted successfully');
        },
        onError: (error) => {
            console.error('Delete error:', error);
            toast.error('Failed to delete listing: ' + error.message);
        },
    });

    const promoteUserMutation = useMutation({
        mutationFn: async ({ userId, newRole }) => {
            try {
                console.log('🟦 Updating user role:', userId, newRole);
                const result = await firebase.entities.User.update(userId, { role: newRole });
                console.log('🟦 User role updated successfully:', result);
                return result;
            } catch (error) {
                console.error('🔴 Update failed:', error.message);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            setUserToPromote(null);
            toast.success('User role updated successfully');
        },
        onError: (error) => {
            console.error('Update error:', error);
            toast.error('Failed to update user role: ' + error.message);
        },
    });

    const deleteListingsMutation = useMutation({
        mutationFn: async (listingIds) => {
            await Promise.all(listingIds.map(id => firebase.entities.GarageSale.delete(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allListings'] });
            setSelectedPastListings([]);
            toast.success('Listings deleted');
        },
        onError: () => {
            toast.error('Failed to delete listings');
        },
    });

    const updateMessageStatusMutation = useMutation({
        mutationFn: async ({ messageId, status }) => {
            await firebase.entities.ContactMessage.update(messageId, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contactMessages'] });
            toast.success('Message status updated');
        },
        onError: () => {
            toast.error('Failed to update message status');
        },
    });

    const deleteMessageMutation = useMutation({
        mutationFn: async (messageId) => {
            await firebase.entities.ContactMessage.delete(messageId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contactMessages'] });
            toast.success('Message deleted');
        },
        onError: () => {
            toast.error('Failed to delete message');
        },
    });

    const sendResponseMutation = useMutation({
        mutationFn: async ({ messageId, response, message }) => {
            // Save response to Firestore
            await firebase.entities.ContactMessage.update(messageId, {
                response: response,
                response_by: user?.email,
                response_at: new Date()
            });

            // Send email notification
            try {
                await firebase.firebaseFunctions.invoke('sendContactResponseEmail', {
                    userEmail: message.email,
                    userName: message.name,
                    originalMessage: message.message,
                    responseMessage: response
                });
            } catch (error) {
                console.error('Failed to send email:', error);
                // Don't fail the response if email fails
            }
        },
        onSuccess: (_, { messageId }) => {
            queryClient.invalidateQueries({ queryKey: ['contactMessages'] });
            setResponseTexts(prev => ({ ...prev, [messageId]: '' }));
            setExpandedMessageId(null);
            toast.success('Response sent and email notification queued');
        },
        onError: () => {
            toast.error('Failed to send response');
        },
    });

    const handleSaveFreeListingPeriod = () => {
        console.log('📋 handleSaveFreeListingPeriod called with:', { freeListingActive, freeListingStart, freeListingEnd });
        console.log('📊 Status: Active?', freeListingActive, 'Start?', !!freeListingStart, 'End?', !!freeListingEnd);
        
        if (freeListingActive && (!freeListingStart || !freeListingEnd)) {
            toast.error('Please set both start and end dates');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 Today is:', today);
        console.log('📅 Free period start:', freeListingStart);
        console.log('📅 Free period end:', freeListingEnd);
        console.log('✅ Will free period be active today?', freeListingActive && freeListingStart <= today && today <= freeListingEnd);
        
        console.log('🚀 Triggering save mutation');
        saveFreeListingPeriodMutation.mutate({
            startDate: freeListingStart,
            endDate: freeListingEnd,
            isActive: freeListingActive,
        });
    };

    // Check if free listing period is currently active
    const isFreePeriodActive = () => {
        if (!freeListingActive || !freeListingStart || !freeListingEnd) return false;
        const today = startOfDay(new Date());
        const start = startOfDay(parseISO(freeListingStart));
        const end = startOfDay(parseISO(freeListingEnd));
        return !isBefore(today, start) && !isAfter(today, end);
    };

    if (loading || listingsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }

    const StatCard = ({ title, value, icon: Icon, trend, color = "bg-[#102a43]" }) => (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <p className="text-3xl font-bold text-[#1e3a5f] mt-2">{value}</p>
                        {trend && (
                            <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
                                <TrendingUp className="w-4 h-4" />
                                {trend}
                            </p>
                        )}
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-10 flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const ListingRow = ({ listing, showActions = false, showDeleteButton = false, overrideStatus = null }) => {
        const displayStatus = overrideStatus || listing.status;
        const approveClickRef = useRef(false);
        const rejectClickRef = useRef(false);
        const deleteClickRef = useRef(false);
        
        const handleApproveClick = (e) => {
            if (approveClickRef.current) return; // Prevent double-click
            approveClickRef.current = true;
            e.preventDefault();
            e.stopPropagation();
            console.log('Approve button clicked for listing:', listing.id);
            approveMutation.mutate(listing.id);
            setTimeout(() => { approveClickRef.current = false; }, 500);
        };

        const handleRejectClick = (e) => {
            if (rejectClickRef.current) return; // Prevent double-click
            rejectClickRef.current = true;
            e.preventDefault();
            e.stopPropagation();
            console.log('Reject button clicked for listing:', listing.id);
            setSelectedListing(listing);
            setTimeout(() => { rejectClickRef.current = false; }, 500);
        };

        const handleDeleteClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setListingToDelete(listing);
        };

        const handleViewClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = createPageUrl(`ListingDetails?id=${listing.id}`);
        };

        return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-white rounded-xl border hover:border-slate-300">
            <div className="flex items-start md:items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                    {listing.photos && listing.photos.length > 0 ? (
                        <img
                            src={listing.photos[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Tag className="w-5 h-5 text-slate-300" />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-[#1e3a5f] break-words">{listing.title}</h4>
                    <p className="text-sm text-slate-500 break-words">
                        📍 {listing.address} • {listing.suburb} {listing.postcode} {listing.state}
                    </p>
                    <p className="text-sm text-slate-500 break-words">
                        📅 {listing.start_date ? format(parseISO(listing.start_date), 'MMM d, yyyy') : 'No date'}{listing.start_time && ` ${listing.start_time}`}{listing.end_time && ` - ${listing.end_time}`}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <Badge className={`${statusConfig[displayStatus]?.color} transition-none whitespace-nowrap`}>
                    {statusConfig[displayStatus]?.label}
                </Badge>
                {showActions && listing.status === 'pending_approval' && (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 transition-none"
                            onMouseDown={handleApproveClick}
                            aria-label="Approve listing"
                        >
                            <Check className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 transition-none"
                            onMouseDown={handleRejectClick}
                            aria-label="Reject listing"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </>
                )}
                {showDeleteButton && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 transition-none"
                        onMouseDown={handleDeleteClick}
                        aria-label="Delete listing"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
                <Button size="sm" variant="ghost" className="transition-none" onMouseDown={handleViewClick} aria-label="View listing details">
                    <Eye className="w-4 h-4" />
                </Button>
            </div>
        </div>
        );
    };

    // Show loading spinner while initializing
    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading Admin Dashboard...</p>
                </div>
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
                alt="watermark"
                className="fixed left-0 pointer-events-none watermark-page"
                style={{
                    width: '1200px',
                    height: 'auto',
                    clipPath: 'polygon(0 0, 46% 0, 46% 100%, 0 100%)',
                    top: '35px',
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
            <div className="max-w-7xl mx-auto pt-8 md:pt-20 relative z-10">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#1e3a5f]">Admin Dashboard</h1>
                        <p className="text-slate-500">Manage listings and view analytics</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 -mb-16">
                    <StatCard
                        title="Active Listings"
                        value={activeListings.length}
                        icon={Tag}
                        color="bg-green-500"
                    />
                    <StatCard
                        title="Pending Approval"
                        value={pendingListings.length}
                        icon={Clock}
                        color="bg-yellow-500"
                    />
                    <StatCard
                        title="Monthly Revenue"
                        value={`$${monthlyRevenue.toFixed(2)}`}
                        icon={DollarSign}
                        color="bg-[#1e3a5f]"
                    />
                    <StatCard
                        title="Total Revenue"
                        value={`$${totalRevenue.toFixed(2)}`}
                        icon={TrendingUp}
                        color="bg-purple-500"
                    />
                </div>

                </div>
                </section>

                <section className="relative bg-[#f5f1e8]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-white border border-slate-200 rounded-lg p-1 w-full justify-start overflow-x-auto md:overflow-visible md:flex-wrap">
                        <TabsTrigger value="listings" className="text-xs md:text-sm whitespace-nowrap">Listings</TabsTrigger>
                        <TabsTrigger value="pending" className="relative flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
                            <span className="hidden sm:inline">Listing Approval</span>
                            <span className="sm:hidden">Approval</span>
                            {pendingListings.length > 0 && (
                                <Badge className="bg-yellow-500 text-white text-xs">
                                    {pendingListings.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="text-xs md:text-sm whitespace-nowrap">Analytics</TabsTrigger>
                        <TabsTrigger value="users" className="text-xs md:text-sm whitespace-nowrap">Users</TabsTrigger>
                        <TabsTrigger value="payments" className="text-xs md:text-sm whitespace-nowrap">Payments</TabsTrigger>
                        <TabsTrigger value="messages" className="relative flex items-center gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
                            <span className="hidden sm:inline">Messages</span>
                            <span className="sm:hidden">Msgs</span>
                            {contactMessages.filter(msg => msg.status === 'unread').length > 0 && (
                                <Badge className="bg-blue-500 text-white text-xs">
                                    {contactMessages.filter(msg => msg.status === 'unread').length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="text-xs md:text-sm whitespace-nowrap">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="listings" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <CardTitle>
                                        All Listings ({
                                            listingsFilter === 'all' ? allListings.length :
                                            listingsFilter === 'active' ? activeListings.length :
                                            listingsFilter === 'draft' ? draftListings.length :
                                            pastListings.length
                                        })
                                    </CardTitle>
                                    <div className="flex gap-2 items-center">
                                        <Select value={listingsFilter} onValueChange={setListingsFilter}>
                                            <SelectTrigger className="w-40" aria-label="Filter listings">
                                                <SelectValue placeholder="Select filter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Listings</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="draft">Drafts</SelectItem>
                                                <SelectItem value="past">Past</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {listingsFilter === 'past' && selectedPastListings.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    if (confirm(`Delete ${selectedPastListings.length} listing(s)?`)) {
                                                        deleteListingsMutation.mutate(selectedPastListings);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete ({selectedPastListings.length})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const displayListings = 
                                        listingsFilter === 'all' ? allListings :
                                        listingsFilter === 'active' ? activeListings :
                                        listingsFilter === 'draft' ? draftListings :
                                        pastListings;

                                    if (displayListings.length === 0) {
                                        return (
                                            <div className="text-center py-12">
                                                <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                                <p className="text-slate-500">No listings found</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-3">
                                            {displayListings.map(listing => (
                                                <div key={listing.id} className="flex items-center gap-3">
                                                    {listingsFilter === 'past' && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPastListings.includes(listing.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedPastListings([...selectedPastListings, listing.id]);
                                                                } else {
                                                                    setSelectedPastListings(selectedPastListings.filter(id => id !== listing.id));
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded border-slate-300"
                                                        />
                                                    )}
                                                    <div className="flex-1">
                                                        <ListingRow 
                                                            listing={listing} 
                                                            showDeleteButton={true}
                                                            overrideStatus={listingsFilter === 'past' ? 'completed' : null}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pending" className="space-y-4">
                        {pendingListings.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border">
                                <Check className="w-12 h-12 text-green-300 mx-auto mb-4" />
                                <p className="text-slate-500">No pending listings</p>
                            </div>
                        ) : (
                            pendingListings.map(listing => (
                                <ListingRow key={listing.id} listing={listing} showActions />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="analytics" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Users & Listings by State */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5" />
                                        Users & Listings by State
                                    </CardTitle>
                                    <div className="flex gap-4 text-sm mt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded bg-red-500" />
                                            <span className="text-slate-500">Users ({allUsers.length})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded bg-green-500" />
                                            <span className="text-slate-500">Listings ({allListings.length})</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={(() => {
                                                const allStates = new Set([...Object.keys(usersByState), ...Object.keys(listingsByState)]);
                                                return Array.from(allStates).filter(s => s !== 'Unknown').sort().map(state => ({
                                                    state,
                                                    users: usersByState[state] || 0,
                                                    listings: listingsByState[state] || 0,
                                                }));
                                            })()}>
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

                            {/* Top Postcodes */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5" />
                                            Top Postcodes
                                        </CardTitle>
                                        <Select value={selectedState} onValueChange={setSelectedState}>
                                            <SelectTrigger className="w-40">
                                                <SelectValue placeholder="All States" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All States</SelectItem>
                                                {statesList.map(state => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={postcodeChartData}>
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

                        {/* Stats Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Summary Statistics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                                        <p className="text-2xl font-bold text-[#1e3a5f]">{allListings.length}</p>
                                        <p className="text-sm text-slate-500">Total Listings</p>
                                    </div>
                                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                                        <p className="text-2xl font-bold text-[#1e3a5f]">{activeListings.length}</p>
                                        <p className="text-sm text-slate-500">Active</p>
                                    </div>
                                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                                        <p className="text-2xl font-bold text-[#1e3a5f]">{completedListings.length}</p>
                                        <p className="text-sm text-slate-500">Completed</p>
                                    </div>
                                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                                        <p className="text-2xl font-bold text-[#1e3a5f]">{Object.keys(listingsByState).length}</p>
                                        <p className="text-sm text-slate-500">States Covered</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="users" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="w-5 h-5" />
                                        Registered Users ({filteredUsers.length})
                                    </CardTitle>
                                    <div className="flex gap-2 flex-wrap">
                                        <Select value={userStateFilter} onValueChange={setUserStateFilter}>
                                            <SelectTrigger className="w-32">
                                                <SelectValue placeholder="All States" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All States</SelectItem>
                                                {userStatesList.map(state => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <Input
                                                placeholder="Postcode..."
                                                value={userPostcodeFilter}
                                                onChange={(e) => setUserPostcodeFilter(e.target.value)}
                                                className="pl-9 w-32"
                                            />
                                        </div>
                                        {incompleteUsers.length > 0 && (
                                            <Button
                                                onClick={() => cleanupIncompleteUsersMutation.mutate()}
                                                disabled={cleanupIncompleteUsersMutation.isPending}
                                                variant="destructive"
                                                size="sm"
                                                className="gap-2"
                                            >
                                                {cleanupIncompleteUsersMutation.isPending ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <X className="w-4 h-4" />
                                                        Cleanup {incompleteUsers.length} Incomplete User(s)
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredUsers.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">No users found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredUsers.map(u => (
                                            <div
                                                key={u.id}
                                                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-[#1e3a5f] truncate">
                                                            {u.full_name || 'No name'}
                                                        </p>
                                                        {u.role === 'admin' && (
                                                            <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-500 truncate">{u.email}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
                                                        {u.state && <span>{u.state}</span>}
                                                        {u.postcode && <span>• {u.postcode}</span>}
                                                        {u.last_login && (
                                                            <span>• Last login: {format(parseISO(u.last_login), 'MMM d, yyyy h:mm a')}</span>
                                                        )}
                                                        {!u.last_login && u.created_date && (
                                                            <span>• Joined: {format(parseISO(u.created_date), 'MMM d, yyyy')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setSelectedUserDetails(u)}
                                                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                                        title="View user details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setUserToPromote(u)}
                                                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                                    >
                                                        <ShieldCheck className="w-4 h-4" />
                                                    </Button>
                                                    {u.email !== user?.email && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setUserToDelete(u)}
                                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="payments" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment History</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Filters */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">Date Paid</label>
                                        <Select value={paymentDateFilter} onValueChange={setPaymentDateFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Dates</SelectItem>
                                                <SelectItem value="today">Today</SelectItem>
                                                <SelectItem value="week">Last 7 Days</SelectItem>
                                                <SelectItem value="month">Last 30 Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">Suburb</label>
                                        <Select value={paymentSuburbFilter} onValueChange={setPaymentSuburbFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Suburbs</SelectItem>
                                                {[...new Set(allPayments.map(p => paymentListingData[p.id]?.sale?.suburb).filter(Boolean))].map(suburb => (
                                                    <SelectItem key={suburb} value={suburb}>{suburb}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">State</label>
                                        <Select value={paymentStateFilter} onValueChange={setPaymentStateFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All States</SelectItem>
                                                {[...new Set(allPayments.map(p => paymentListingData[p.id]?.sale?.state).filter(Boolean))].map(state => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Payments List */}
                                {allPayments.length === 0 ? (
                                    <div className="text-center py-8">
                                        <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">No payments recorded yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {allPayments.filter(payment => {
                                            const listingInfo = paymentListingData[payment.id];
                                            
                                            // Date filter
                                            if (paymentDateFilter !== 'all') {
                                                let createdAt;
                                                if (payment.created_at instanceof Date) {
                                                    createdAt = payment.created_at;
                                                } else if (payment.created_at?.toDate) {
                                                    createdAt = payment.created_at.toDate();
                                                } else if (typeof payment.created_at === 'string') {
                                                    createdAt = parseISO(payment.created_at);
                                                } else {
                                                    return false;
                                                }
                                                const now = new Date();
                                                const days = paymentDateFilter === 'today' ? 0 : paymentDateFilter === 'week' ? 7 : 30;
                                                const startDate = new Date(now);
                                                startDate.setDate(startDate.getDate() - days);
                                                if (createdAt < startDate) return false;
                                            }
                                            
                                            // Suburb filter
                                            if (paymentSuburbFilter !== 'all' && listingInfo?.sale?.suburb !== paymentSuburbFilter) {
                                                return false;
                                            }
                                            
                                            // State filter
                                            if (paymentStateFilter !== 'all' && listingInfo?.sale?.state !== paymentStateFilter) {
                                                return false;
                                            }
                                            
                                            return true;
                                        }).map(payment => {
                                            const listingInfo = paymentListingData[payment.id];
                                            const sale = listingInfo?.sale;
                                            const paymentUser = listingInfo?.user;
                                            
                                            return (
                                                <div
                                                    key={payment.id}
                                                    className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-purple-200 transition"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="font-semibold text-[#1e3a5f]">${payment.amount?.toFixed(2)}</p>
                                                            <p className="text-sm text-slate-600 mt-1">
                                                                {sale?.title || 'Unknown Listing'}
                                                            </p>
                                                            <p className="text-base font-medium text-slate-900 mt-2">
                                                                {paymentUser?.name || payment.user_email}
                                                            </p>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                                            <div>
                                                                <p className="text-slate-600 font-medium">Date Paid</p>
                                                                <p className="text-slate-700">
                                                                    {payment.created_at ? (() => {
                                                                        let date;
                                                                        if (payment.created_at instanceof Date) {
                                                                            date = payment.created_at;
                                                                        } else if (payment.created_at?.toDate) {
                                                                            date = payment.created_at.toDate();
                                                                        } else if (typeof payment.created_at === 'string') {
                                                                            date = parseISO(payment.created_at);
                                                                        }
                                                                        return date ? format(date, 'MMM d, yyyy') : 'N/A';
                                                                    })() : 'N/A'}
                                                                </p>
                                                                <p className="text-slate-600 text-xs">
                                                                    {payment.created_at ? (() => {
                                                                        let date;
                                                                        if (payment.created_at instanceof Date) {
                                                                            date = payment.created_at;
                                                                        } else if (payment.created_at?.toDate) {
                                                                            date = payment.created_at.toDate();
                                                                        } else if (typeof payment.created_at === 'string') {
                                                                            date = parseISO(payment.created_at);
                                                                        }
                                                                        return date ? format(date, 'h:mm a') : 'N/A';
                                                                    })() : 'N/A'}
                                                                </p>
                                                            </div>
                                                            
                                                            <div>
                                                                <p className="text-slate-600 font-medium">Location</p>
                                                                <p className="text-slate-700">
                                                                    {sale?.suburb || 'N/A'}
                                                                </p>
                                                                <p className="text-slate-600 text-xs">
                                                                    {sale?.state || 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
                                                        <div className="text-xs text-slate-500">
                                                            Transaction ID: {payment.transaction_id}
                                                        </div>
                                                        <Badge className={
                                                            payment.status === 'completed'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-yellow-100 text-yellow-700'
                                                        }>
                                                            {payment.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                        {/* Promotional Messages Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    Promotional Messages (Rotating every 5 seconds)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Show all existing promotional messages */}
                                {allPromotions.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-slate-700 mb-3">Active Messages:</p>
                                        {allPromotions.map((promo, index) => (
                                            <div key={promo.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-xs font-bold">
                                                                {index + 1}
                                                            </span>
                                                            <p className="text-sm text-slate-600">{promo.message}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {index > 0 && (
                                                            <Button
                                                                onClick={() => {
                                                                    reorderPromoMessageMutation.mutate({
                                                                        promoId: promo.id,
                                                                        newSequence: index - 1,
                                                                    });
                                                                    // Also update the one above
                                                                    if (allPromotions[index - 1]) {
                                                                        reorderPromoMessageMutation.mutate({
                                                                            promoId: allPromotions[index - 1].id,
                                                                            newSequence: index,
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={reorderPromoMessageMutation.isPending}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0"
                                                                title="Move up"
                                                            >
                                                                ↑
                                                            </Button>
                                                        )}
                                                        {index < allPromotions.length - 1 && (
                                                            <Button
                                                                onClick={() => {
                                                                    reorderPromoMessageMutation.mutate({
                                                                        promoId: promo.id,
                                                                        newSequence: index + 2,
                                                                    });
                                                                    // Also update the one below
                                                                    if (allPromotions[index + 1]) {
                                                                        reorderPromoMessageMutation.mutate({
                                                                            promoId: allPromotions[index + 1].id,
                                                                            newSequence: index + 1,
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={reorderPromoMessageMutation.isPending}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0"
                                                                title="Move down"
                                                            >
                                                                ↓
                                                            </Button>
                                                        )}
                                                        <Button
                                                            onClick={() => {
                                                                setPromoMessage(promo.message);
                                                                setEditingPromoId(promo.id);
                                                                setShowPromoInput(true);
                                                            }}
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            onClick={() => deletePromoMessageMutation.mutate(promo.id)}
                                                            disabled={deletePromoMessageMutation.isPending}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                                                            title="Delete"
                                                        >
                                                            {deletePromoMessageMutation.isPending ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3 h-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Form to add/edit promotional messages */}
                                {showPromoInput && (
                                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                {editingPromoId ? 'Edit Message' : 'New Promotional Message'}
                                            </label>
                                            <Textarea
                                                value={promoMessage}
                                                onChange={(e) => setPromoMessage(e.target.value)}
                                                placeholder="E.g., 🎉 List your garage sale and reach hundreds of local buyers!"
                                                className="min-h-[80px]"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                This message will rotate on the homepage every 5 seconds
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => savePromoMessageMutation.mutate({ message: promoMessage, sequence: editingPromoId ? allPromotions.find(p => p.id === editingPromoId)?.sequence : 1 })}
                                                disabled={savePromoMessageMutation.isPending || !promoMessage.trim()}
                                                className="bg-[#1e3a5f] hover:bg-[#152a45]"
                                            >
                                                {savePromoMessageMutation.isPending ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : null}
                                                {editingPromoId ? 'Update' : 'Add'} Message
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setShowPromoInput(false);
                                                    setPromoMessage('');
                                                    setEditingPromoId(null);
                                                }}
                                                variant="outline"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Button to add new message or minimal state */}
                                {!showPromoInput && (
                                    <Button
                                        onClick={() => {
                                            setShowPromoInput(true);
                                            setPromoMessage('');
                                            setEditingPromoId(null);
                                        }}
                                        className="bg-[#1e3a5f] hover:bg-[#152a45] w-full"
                                    >
                                        + Add Promotional Message
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Free Listing Period Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    Free Listing Period
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {localStorage.getItem('freeListingPeriod') && (
                                    <Alert className="bg-amber-50 border-amber-200">
                                        <AlertDescription className="text-amber-700 text-sm">
                                            <strong>⚠️ Temporary storage:</strong> Settings are stored in browser. To make permanent, deploy Firestore rules to your Firebase project.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${isFreePeriodActive() ? 'bg-green-500' : 'bg-slate-300'}`} />
                                        <div>
                                            <p className="font-medium text-[#1e3a5f]">Free Listings</p>
                                            <p className="text-sm text-slate-500">
                                                {isFreePeriodActive() 
                                                    ? 'Currently active - listings are FREE' 
                                                    : freeListingActive 
                                                        ? 'Scheduled but not in date range'
                                                        : 'Disabled - $10 per listing'}
                                            </p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={freeListingActive}
                                            onChange={(e) => setFreeListingActive(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a5f]"></div>
                                    </label>
                                </div>

                                {freeListingActive && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                <Calendar className="w-4 h-4 inline mr-1" />
                                                Start Date
                                            </label>
                                            <Input
                                                type="date"
                                                value={freeListingStart}
                                                onChange={(e) => setFreeListingStart(e.target.value)}
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                <Calendar className="w-4 h-4 inline mr-1" />
                                                End Date
                                            </label>
                                            <Input
                                                type="date"
                                                value={freeListingEnd}
                                                onChange={(e) => setFreeListingEnd(e.target.value)}
                                                min={freeListingStart}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleSaveFreeListingPeriod}
                                    disabled={saveFreeListingPeriodMutation.isPending}
                                    className="bg-[#1e3a5f] hover:bg-[#152a45]"
                                >
                                    {saveFreeListingPeriodMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    Save Settings
                                </Button>

                                {freeListingActive && freeListingStart && freeListingEnd && (
                                    <div className="space-y-3">
                                        <div className={`p-4 rounded-xl border ${isFreePeriodActive() ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
                                            <p className={`text-sm font-medium ${isFreePeriodActive() ? 'text-green-700' : 'text-[#1e3a5f]'}`}>
                                                {isFreePeriodActive() ? '✅ FREE PERIOD ACTIVE TODAY!' : '⏳ Free period scheduled'}
                                            </p>
                                            <p className="text-sm mt-2">
                                                <strong>Period:</strong> {format(parseISO(freeListingStart), 'MMM d, yyyy')} - {format(parseISO(freeListingEnd), 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2">
                                                During this period, all new listings will be published for $0.00 instead of $10.00
                                            </p>
                                            <p className="text-xs text-slate-600 mt-2 bg-white/50 p-2 rounded">
                                                🔍 Today: {new Date().toISOString().split('T')[0]}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="messages" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <CardTitle>Messages</CardTitle>
                                    <Select value={messageFilter} onValueChange={setMessageFilter}>
                                        <SelectTrigger className="w-full sm:w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Messages</SelectItem>
                                            <SelectItem value="waiting">Waiting for Response</SelectItem>
                                            <SelectItem value="closed">Closed (Responded)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {messagesLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                                    </div>
                                ) : (() => {
                                    const filteredMessages = contactMessages.filter(msg => {
                                        if (messageFilter === 'waiting') return !msg.response;
                                        if (messageFilter === 'closed') return msg.response;
                                        return true;
                                    });

                                    return filteredMessages.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-slate-500">
                                                {messageFilter === 'waiting' && 'No messages waiting for response'}
                                                {messageFilter === 'closed' && 'No messages with responses'}
                                                {messageFilter === 'all' && 'No contact messages yet'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {filteredMessages.map((message) => (
                                            <Card key={message.id} className={`border ${message.status === 'unread' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                                <CardContent className="pt-6">
                                                    <div className="space-y-3">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <h3 className="font-semibold text-slate-700">{message.name}</h3>
                                                                <p className="text-sm text-slate-500">{message.email}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-500">
                                                                    {message.created_at && format(
                                                                        message.created_at instanceof Date 
                                                                            ? message.created_at 
                                                                            : message.created_at.toDate?.()
                                                                        , 
                                                                        'MMM d, yyyy h:mm a'
                                                                    )}
                                                                </p>
                                                                {message.status === 'unread' && (
                                                                    <Badge className="bg-blue-500 text-white mt-1">Unread</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-slate-700 whitespace-pre-wrap">{message.message}</p>
                                                        
                                                        {/* Existing Response */}
                                                        {message.response && (
                                                            <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                                                                <p className="text-xs font-semibold text-green-700 mb-1">Response from {message.response_by || 'Admin'}</p>
                                                                <p className="text-sm text-green-800 whitespace-pre-wrap">{message.response}</p>
                                                                {message.response_at && (
                                                                    <p className="text-xs text-green-600 mt-2">
                                                                        {format(
                                                                            message.response_at instanceof Date 
                                                                                ? message.response_at 
                                                                                : message.response_at.toDate?.()
                                                                            , 
                                                                            'MMM d, yyyy h:mm a'
                                                                        )}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Response Input */}
                                                        {expandedMessageId === message.id && (
                                                            <div className="mt-4 space-y-2 p-3 bg-slate-50 rounded border border-slate-200">
                                                                <label className="text-sm font-medium text-slate-700">Your Response</label>
                                                                <Textarea
                                                                    value={responseTexts[message.id] || ''}
                                                                    onChange={(e) => setResponseTexts(prev => ({
                                                                        ...prev,
                                                                        [message.id]: e.target.value
                                                                    }))}
                                                                    placeholder="Type your response here..."
                                                                    rows={4}
                                                                    className="resize-none"
                                                                />
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => sendResponseMutation.mutate({
                                                                            messageId: message.id,
                                                                            response: responseTexts[message.id],
                                                                            message
                                                                        })}
                                                                        disabled={sendResponseMutation.isPending || !responseTexts[message.id]?.trim()}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        {sendResponseMutation.isPending ? (
                                                                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                        ) : null}
                                                                        Send Response
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setExpandedMessageId(null);
                                                                            setResponseTexts(prev => ({ ...prev, [message.id]: '' }));
                                                                        }}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex gap-2 pt-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => updateMessageStatusMutation.mutate({
                                                                    messageId: message.id,
                                                                    status: message.status === 'unread' ? 'read' : 'unread'
                                                                })}
                                                                disabled={updateMessageStatusMutation.isPending}
                                                                className="flex-1"
                                                            >
                                                                {updateMessageStatusMutation.isPending ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                ) : null}
                                                                {message.status === 'unread' ? 'Mark as Read' : 'Mark as Unread'}
                                                            </Button>
                                                            {!message.response && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => setExpandedMessageId(expandedMessageId === message.id ? null : message.id)}
                                                                    className="bg-blue-50 hover:bg-blue-100"
                                                                >
                                                                    {expandedMessageId === message.id ? 'Close' : 'Reply'}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => deleteMessageMutation.mutate(message.id)}
                                                                disabled={deleteMessageMutation.isPending}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                {deleteMessageMutation.isPending ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* User Details Dialog */}
                <Dialog open={!!selectedUserDetails} onOpenChange={() => setSelectedUserDetails(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>User Details</DialogTitle>
                        </DialogHeader>
                        {selectedUserDetails && (
                            <div className="space-y-4 pt-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</p>
                                    <p className="text-base font-medium text-slate-900">{selectedUserDetails.full_name || 'Not provided'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
                                    <p className="text-base text-slate-900">{selectedUserDetails.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</p>
                                    <p className="text-base text-slate-900">{selectedUserDetails.phone || 'Not provided'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</p>
                                    <p className="text-base text-slate-900">{selectedUserDetails.address || 'Not provided'}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">State</p>
                                        <p className="text-base text-slate-900">{selectedUserDetails.state || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Postcode</p>
                                        <p className="text-base text-slate-900">{selectedUserDetails.postcode || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</p>
                                        <p className="text-base text-slate-900">{selectedUserDetails.role || 'user'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</p>
                                    <p className="text-base text-slate-900">
                                        {selectedUserDetails.created_date 
                                            ? format(parseISO(selectedUserDetails.created_date), 'MMM d, yyyy') 
                                            : 'Unknown'}
                                    </p>
                                </div>
                                {selectedUserDetails.last_login && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Login</p>
                                        <p className="text-base text-slate-900">
                                            {format(parseISO(selectedUserDetails.last_login), 'MMM d, yyyy h:mm a')}
                                        </p>
                                    </div>
                                )}
                                <div className="pt-4">
                                    <Button
                                        onClick={() => setSelectedUserDetails(null)}
                                        className="w-full"
                                        variant="outline"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Delete User Dialog */}
                <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete User</DialogTitle>
                            <DialogDescription>
                                Permanently remove this user from the system
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <p className="text-slate-600">
                                Are you sure you want to delete <strong>{userToDelete?.full_name || userToDelete?.email}</strong>?
                            </p>
                            <p className="text-sm text-red-600">This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setUserToDelete(null)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => deleteUserMutation.mutate(userToDelete.id)}
                                    disabled={deleteUserMutation.isPending}
                                    className="flex-1 bg-red-500 hover:bg-red-600"
                                >
                                    {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Delete Listing Dialog */}
                <Dialog open={!!listingToDelete} onOpenChange={() => setListingToDelete(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Listing</DialogTitle>
                            <DialogDescription>
                                Permanently remove this listing from the system
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <p className="text-slate-600">
                                Are you sure you want to delete <strong>{listingToDelete?.title}</strong>?
                            </p>
                            <p className="text-sm text-red-600">This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setListingToDelete(null)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => deleteListingMutation.mutate(listingToDelete.id)}
                                    disabled={deleteListingMutation.isPending}
                                    className="flex-1 bg-red-500 hover:bg-red-600"
                                >
                                    {deleteListingMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Promote User Dialog */}
                <Dialog open={!!userToPromote} onOpenChange={() => setUserToPromote(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change User Role</DialogTitle>
                            <DialogDescription>
                                Update admin status for {userToPromote?.full_name || userToPromote?.email}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <p className="text-slate-600">
                                Change role for <strong>{userToPromote?.full_name || userToPromote?.email}</strong>
                            </p>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-slate-500">
                                    Current role:
                                </p>
                                <Badge className={userToPromote?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}>
                                    {userToPromote?.role || 'user'}
                                </Badge>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setUserToPromote(null)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                {userToPromote?.role === 'admin' ? (
                                    <Button
                                        onClick={() => promoteUserMutation.mutate({ userId: userToPromote.id, newRole: 'user' })}
                                        disabled={promoteUserMutation.isPending || userToPromote?.email === user?.email}
                                        className="flex-1 bg-slate-500 hover:bg-slate-600"
                                    >
                                        {promoteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                        Remove Admin
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => promoteUserMutation.mutate({ userId: userToPromote.id, newRole: 'admin' })}
                                        disabled={promoteUserMutation.isPending}
                                        className="flex-1 bg-purple-500 hover:bg-purple-600"
                                    >
                                        {promoteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                        Make Admin
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Rejection Dialog */}
                <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Listing</DialogTitle>
                            <DialogDescription>
                                Provide a reason for rejecting this listing
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div>
                                <p className="text-sm text-slate-500 mb-2">
                                    Rejecting: <strong>{selectedListing?.title}</strong>
                                </p>
                                <Textarea
                                    placeholder="Enter reason for rejection..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedListing(null)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => rejectMutation.mutate({
                                        listingId: selectedListing.id,
                                        reason: rejectionReason,
                                    })}
                                    disabled={!rejectionReason.trim()}
                                    className="flex-1 bg-red-500 hover:bg-red-600"
                                >
                                    Reject
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                </div>
            </section>
        </div>
    );
}