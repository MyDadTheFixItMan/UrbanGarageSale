import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { MapPin, Mail, Phone, Pencil, Plus, Loader2,
    Tag, Clock, Trash2, Eye, FileText, CheckCircle, XCircle, CreditCard
} from 'lucide-react';
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, isBefore, startOfToday } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: FileText },
    pending_approval: { label: 'Pending Admin Approval', color: 'bg-blue-100 text-blue-700', icon: Clock },
    active: { label: 'Listing Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    completed: { label: 'Completed', color: 'bg-slate-100 text-slate-700', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function Profile() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [promoIndex, setPromoIndex] = useState(0);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('active');
    const [editForm, setEditForm] = useState({
        email: '',
        full_name: '',
        address: '',
        phone: '',
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFALoading, setTwoFALoading] = useState(false);
    const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false);
    const [cardPaymentsLoading, setCardPaymentsLoading] = useState(false);

    const { data: allPromotions = [] } = useQuery({
        queryKey: ['allPromotions'],
        queryFn: async () => {
            try {
                return await firebase.firestore.collection('promotions').getDocs('sequence', 'asc');
            } catch (error) {
                console.error('Error fetching promotions:', error);
                return [];
            }
        },
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

    useEffect(() => {
        const init = async () => {
            const authenticated = await firebase.auth.isAuthenticated();
            if (!authenticated) {
                window.location.href = '/login';
                return;
            }
            const userData = await firebase.auth.me();
            console.log('Profile loaded - User data:', {
              email: userData.email,
              full_name: userData.full_name,
              address: userData.address,
              phone: userData.phone,
              phone_verified: userData.phone_verified,
              role: userData.role
            });
            setUser(userData);
            setEditForm({
                email: userData.email || '',
                full_name: userData.full_name || '',
                address: userData.address || '',
                phone: userData.phone || '',
            });
            
            // Load 2FA status
            const is2FAEnabled = await firebase.auth.is2FAEnabled();
            setTwoFAEnabled(is2FAEnabled);
            
            // Load card payments status
            const cardPaymentsStatus = userData.cardPaymentsEnabled || false;
            const stripeConnectId = userData.stripeConnectId || null;
            setCardPaymentsEnabled(cardPaymentsStatus && !!stripeConnectId);
            
            setLoading(false);
        };
        init();
    }, []);

    const { data: userListings = [], isLoading: listingsLoading } = useQuery({
        queryKey: ['userListings', user?.email],
        queryFn: () => firebase.entities.GarageSale.filter({ created_by: user.email }),
        enabled: !!user?.email,
    });

    const activeListings = userListings.filter(l => (l.status === 'active' || l.status === 'pending_approval') && l.end_date && !isBefore(parseISO(l.end_date), startOfToday()) && l.payment_status === 'paid');
    const draftListings = userListings.filter(l => l.status === 'draft');
    const pastListings = userListings.filter(l => l.status === 'completed' || ((l.status === 'active' || l.status === 'pending_approval') && l.end_date && isBefore(parseISO(l.end_date), startOfToday())));

    const updateProfileMutation = useMutation({
        mutationFn: async (data) => {
            console.log('Updating profile with data:', data);
            await firebase.auth.updateProfile(data);
        },
        onSuccess: () => {
            console.log('Profile update successful - refreshing user data');
            setUser(prev => ({ ...prev, ...editForm }));
            setEditDialogOpen(false);
            toast.success('Profile updated successfully');
            // Invalidate and refetch user data
            queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            await firebase.entities.GarageSale.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userListings'] });
            toast.success('Listing deleted');
        },
    });

    const changePasswordMutation = useMutation({
        mutationFn: async (data) => {
            await firebase.auth.changePassword(data.currentPassword, data.newPassword);
        },
        onSuccess: () => {
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordError('');
            setChangePasswordDialogOpen(false);
            toast.success('Password changed successfully');
        },
        onError: (error) => {
            setPasswordError(error.message || 'Failed to change password');
        },
    });

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');

        // Validation
        if (!passwordForm.currentPassword) {
            setPasswordError('Please enter your current password');
            return;
        }
        if (!passwordForm.newPassword) {
            setPasswordError('Please enter a new password');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        changePasswordMutation.mutate(passwordForm);
    };

    const handleResetPassword = async () => {
        setResetPasswordLoading(true);
        try {
            await firebase.auth.resetPassword(user?.email);
            toast.success('Password reset email sent to your inbox');
            setChangePasswordDialogOpen(false);
        } catch (error) {
            toast.error(error.message || 'Failed to send reset email');
        } finally {
            setResetPasswordLoading(false);
        }
    };

    const handleToggle2FA = async () => {
        setTwoFALoading(true);
        try {
            if (twoFAEnabled) {
                // Disable 2FA
                await firebase.auth.disable2FA();
                setTwoFAEnabled(false);
                toast.success('Two-Factor Authentication disabled');
            } else {
                // Enable 2FA
                if (!user?.phone || !user?.phone_verified) {
                    toast.error('Please add and verify a phone number first');
                    setTwoFALoading(false);
                    return;
                }
                await firebase.auth.enable2FA();
                setTwoFAEnabled(true);
                toast.success('Two-Factor Authentication enabled');
            }
        } catch (error) {
            toast.error(error.message || 'Failed to update 2FA settings');
        } finally {
            setTwoFALoading(false);
        }
    };

    const handleEnableCardPayments = async () => {
        setCardPaymentsLoading(true);
        try {
            // Get the user's ID token
            const currentUser = firebase.auth.getCurrentUser();
            if (!currentUser) {
                throw new Error('Not authenticated');
            }

            const token = await currentUser.getIdToken();

            // Call the backend to initialize Stripe Connect
            const response = await fetch('https://urban-garage-sale.vercel.app/api/urbanPayment/enableStripeConnect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: user.email,
                    firstName: user.full_name?.split(' ')[0] || 'Seller',
                    lastName: user.full_name?.split(' ').slice(1).join(' ') || user.email.split('@')[0],
                    address: user.address,
                    city: 'Sydney',
                    state: 'NSW',
                    postcode: '2000',
                    refreshUrl: window.location.href,
                    returnUrl: window.location.href,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed: ${response.status}`);
            }

            const data = await response.json();

            // Redirect to Stripe onboarding
            if (data.onboardingUrl) {
                window.location.href = data.onboardingUrl;
            }
        } catch (error) {
            console.error('Error enabling card payments:', error);
            toast.error('Failed to enable card payments: ' + error.message);
            setCardPaymentsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }

    const ListingCard = ({ listing }) => {
        const status = statusConfig[listing.status] || statusConfig.draft;

        return (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300">
                {/* Image - Full width 16:9 */}
                <div className="w-full aspect-video bg-slate-100 overflow-hidden rounded-t-lg">
                    {listing.photos && listing.photos.length > 0 ? (
                        <img
                            src={listing.photos[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                            <Tag className="w-12 h-12 text-slate-400" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* Status Badge */}
                    <div className="mb-3">
                        <Badge className={`${status.color} rounded-full text-xs font-medium px-3 py-1`}>
                            {status.label}
                        </Badge>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-[20px] text-slate-900 mb-2 line-clamp-2">
                        {listing.title}
                    </h3>

                    {/* Date and Time */}
                    <p className="text-sm font-medium text-slate-600 mb-2">
                        📅 {listing.start_date ? format(parseISO(listing.start_date), 'MMM d, yyyy') : 'No date'} 
                        {listing.start_time && ` — ${listing.start_time}`}{listing.end_time && ` to ${listing.end_time}`}
                    </p>

                    {/* Address */}
                    <p className="text-sm text-slate-500 mb-4">
                        📍 {listing.address && listing.suburb ? `${listing.address}, ${listing.suburb}` : listing.address || 'No address'}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        {/* View Button */}
                        {(listing.status === 'active' || listing.status === 'pending_approval' || listing.status === 'completed' || listing.status === 'rejected') && (
                            <Link to={createPageUrl(`ListingDetails?id=${listing.id}`)} className="flex-1">
                                <Button size="sm" variant="outline" className="w-full h-9 text-sm font-medium">
                                    <Eye className="w-4 h-4 mr-1.5" />
                                    View
                                </Button>
                            </Link>
                        )}

                        {/* Edit Button */}
                        {(listing.status === 'draft' || listing.status === 'active') && (
                            <Link to={createPageUrl(`CreateListing?edit=${listing.id}`)} className="flex-1">
                                <Button size="sm" variant="outline" className="w-full h-9 text-sm font-medium">
                                    <Pencil className="w-4 h-4 mr-1.5" />
                                    Edit
                                </Button>
                            </Link>
                        )}

                        {/* Pay Button (for drafts) */}
                        {listing.status === 'draft' && (
                            <Link to={createPageUrl(`Payment?id=${listing.id}`)} className="flex-1">
                                <Button size="sm" className="w-full h-9 text-sm font-medium bg-[#1e3a5f] hover:bg-[#152a45]">
                                    Pay $10
                                </Button>
                            </Link>
                        )}

                        {/* Delete Button */}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-9 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Listing?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your listing.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => deleteMutation.mutate(listing.id)}
                                        className="bg-red-500 hover:bg-red-600"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] overflow-hidden pb-24 md:pb-0">
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
            
            <section className="relative bg-[#f5f1e8] py-0 sm:py-8 md:py-16 px-4 sm:px-6 overflow-hidden -mt-2">
                <div className="max-w-4xl mx-auto pt-24 sm:pt-2 md:pt-4 relative z-10">
                {/* Page Header */}
                <div className="flex items-center gap-3 mb-12 sm:mb-8">
                    <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
                        <Pencil className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-[#1e3a5f]">My Profile</h2>
                        <p className="text-slate-500">Manage your account information and listings</p>
                    </div>
                </div>

                {/* Profile Header */}
                <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-6 mb-8 shadow-sm mt-20 sm:mt-0">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d4a6f] flex items-center justify-center text-white text-2xl font-semibold">
                                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-[#1e3a5f]">
                                    {user?.full_name || 'User'}
                                </h1>
                                <p className="text-slate-500">{user?.email}</p>
                            </div>
                        </div>

                        <div className="flex flex-row gap-2 w-full md:w-auto">
                        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 flex-1">
                                    <Pencil className="w-4 h-4" />
                                    Edit Profile
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Edit Profile</DialogTitle>
                                    <DialogDescription>Update your profile information below</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                    <div>
                                        <Label>Name</Label>
                                        <Input
                                            value={editForm.full_name}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label>Address</Label>
                                        <div className="text-sm text-slate-600 mb-2 p-2 bg-slate-50 rounded border border-slate-200">
                                            Saved: {editForm.address || 'Not set'}
                                        </div>
                                        <GooglePlacesAutocomplete
                                            value={editForm.address}
                                            onChange={(val) => setEditForm(prev => ({ ...prev, address: val }))}
                                            onSelect={(place) => {
                                              if (place.address) {
                                                setEditForm(prev => ({ ...prev, address: place.address }));
                                              }
                                            }}
                                            placeholder="123 Main Street, Sydney NSW 2000"
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label>Phone Number</Label>
                                        <Input
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label>Email Address</Label>
                                        <Input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <Button
                                        onClick={() => updateProfileMutation.mutate(editForm)}
                                        disabled={updateProfileMutation.isPending}
                                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45]"
                                    >
                                        {updateProfileMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 flex-1">
                                    <Pencil className="w-4 h-4" />
                                    Change Password
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Change Password</DialogTitle>
                                    <DialogDescription>Enter your current password and a new password</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleChangePassword} className="space-y-4 pt-4">
                                    <div>
                                        <Label>Current Password</Label>
                                        <Input
                                            type="password"
                                            value={passwordForm.currentPassword}
                                            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                            className="mt-1.5"
                                            placeholder="Enter current password"
                                        />
                                    </div>
                                    <div>
                                        <Label>New Password</Label>
                                        <Input
                                            type="password"
                                            value={passwordForm.newPassword}
                                            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                            className="mt-1.5"
                                            placeholder="Enter new password (min 6 characters)"
                                        />
                                    </div>
                                    <div>
                                        <Label>Confirm New Password</Label>
                                        <Input
                                            type="password"
                                            value={passwordForm.confirmPassword}
                                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            className="mt-1.5"
                                            placeholder="Confirm new password"
                                        />
                                    </div>
                                    {passwordError && (
                                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                                            {passwordError}
                                        </div>
                                    )}
                                    <Button
                                        type="submit"
                                        disabled={changePasswordMutation.isPending}
                                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45]"
                                    >
                                        {changePasswordMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Update Password'
                                        )}
                                    </Button>
                                    <div className="pt-2 border-t">
                                        <p className="text-sm text-slate-500 mb-3">Or send password reset email:</p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full"
                                            onClick={handleResetPassword}
                                            disabled={resetPasswordLoading}
                                        >
                                            {resetPasswordLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    Sending...
                                                </>
                                            ) : (
                                                'Send Reset Email'
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Button 
                            onClick={cardPaymentsEnabled ? undefined : handleEnableCardPayments}
                            disabled={cardPaymentsLoading || cardPaymentsEnabled}
                            variant={cardPaymentsEnabled ? "outline" : "default"}
                            size="sm" 
                            className={`gap-2 flex-1 ${cardPaymentsEnabled ? 'bg-green-50 border-green-300 text-green-700 cursor-not-allowed opacity-75' : ''}`}
                        >
                            {cardPaymentsLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <CreditCard className="w-4 h-4" />
                                    {cardPaymentsEnabled ? (
                                        <>
                                            Card Payments <span className="text-lg">✓</span>
                                        </>
                                    ) : (
                                        'Enable Card Payments'
                                    )}
                                </>
                            )}
                        </Button>

                        <Button 
                            onClick={handleToggle2FA}
                            disabled={twoFALoading}
                            variant="outline" 
                            size="sm" 
                            className={`gap-2 flex-1 ${twoFAEnabled ? 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-50' : ''}`}
                        >
                            {twoFALoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    {twoFAEnabled ? '2FA On' : '2FA Off'}
                                </>
                            )}
                        </Button>
                    </div>
                    </div>

                    {/* Profile Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
                        {user?.phone && (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Phone</p>
                                    <p className="text-sm font-medium text-[#1e3a5f]">{user.phone}</p>
                                </div>
                            </div>
                        )}
                        {user?.address && (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <MapPin className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Address</p>
                                    <p className="text-sm font-medium text-[#1e3a5f]">{user.address}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Mail className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Email</p>
                                <p className="text-sm font-medium text-[#1e3a5f]">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
                </section>

                <section className="relative bg-[#f5f1e8]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">

                {/* Listings */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-[#1e3a5f]">My Listings</h2>
                    <Link to={createPageUrl('CreateListing')}>
                        <Button className="bg-[#1e3a5f] hover:bg-[#152a45] gap-2">
                            <Plus className="w-4 h-4" />
                            New Listing
                        </Button>
                    </Link>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-white border mb-6">
                        <TabsTrigger value="active" className="gap-2">
                            Active
                            {activeListings.length > 0 && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700">
                                    {activeListings.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="drafts" className="gap-2">
                            Drafts
                            {draftListings.length > 0 && (
                                <Badge variant="secondary" className="bg-slate-100">
                                    {draftListings.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="past">Past</TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="w-full">
                        {listingsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-[#1e3a5f]" />
                            </div>
                        ) : activeListings.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border">
                                <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 mb-4">No active listings</p>
                                <Link to={createPageUrl('CreateListing')}>
                                    <Button className="bg-[#1e3a5f] hover:bg-[#152a45]">
                                        Create Your First Listing
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {activeListings.map(listing => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="drafts" className="w-full">
                        {draftListings.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border">
                                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500">No draft listings</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {draftListings.map(listing => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="past" className="w-full">
                        {pastListings.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border">
                                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500">No past listings</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {pastListings.map(listing => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
                </div>
            </section>
        </div>
    );
}