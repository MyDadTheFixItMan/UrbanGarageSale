import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Pencil, Printer } from 'lucide-react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { paperSizes } from '../../utils/printGarageSaleSign';
import { changePasswordProblem } from './profileListings';

const profileForm = (user) => ({
    email: user?.email || '',
    full_name: user?.full_name || '',
    address: user?.address || '',
    phone: user?.phone || '',
});

export function EditProfileDialog({ user, onSaved }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(() => profileForm(user));
    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    const saveMutation = useMutation({
        mutationFn: (data) => firebase.auth.updateProfile(data),
        onSuccess: (_, data) => {
            onSaved(data);
            setOpen(false);
            toast.success('Profile updated successfully');
        },
        onError: (error) => toast.error('Failed to update profile: ' + error.message),
    });

    const handleOpenChange = (next) => {
        if (next) setForm(profileForm(user));
        setOpen(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
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
                        <Label htmlFor="profile-name">Name</Label>
                        <Input id="profile-name" value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                        <Label>Address</Label>
                        <div className="text-sm text-slate-600 mb-2 p-2 bg-slate-50 rounded border border-slate-200">
                            Saved: {form.address || 'Not set'}
                        </div>
                        <GooglePlacesAutocomplete
                            value={form.address}
                            onChange={set('address')}
                            onSelect={(place) => {
                                if (place.address) set('address')(place.address);
                            }}
                            placeholder="123 Main Street, Sydney NSW 2000"
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <Label htmlFor="profile-phone">Phone Number</Label>
                        <Input id="profile-phone" value={form.phone} onChange={(e) => set('phone')(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                        <Label htmlFor="profile-email">Email Address</Label>
                        <Input id="profile-email" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} className="mt-1.5" />
                    </div>
                    <Button
                        onClick={() => saveMutation.mutate(form)}
                        disabled={saveMutation.isPending}
                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45]"
                    >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordDialog({ email }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_PASSWORDS);
    const [error, setError] = useState('');
    const [sendingReset, setSendingReset] = useState(false);
    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const changeMutation = useMutation({
        mutationFn: ({ currentPassword, newPassword }) => firebase.auth.changePassword(currentPassword, newPassword),
        onSuccess: () => {
            setForm(EMPTY_PASSWORDS);
            setError('');
            setOpen(false);
            toast.success('Password changed successfully');
        },
        onError: (err) => setError(err.message || 'Failed to change password'),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const problem = changePasswordProblem(form);
        setError(problem || '');
        if (!problem) changeMutation.mutate(form);
    };

    const handleResetPassword = async () => {
        setSendingReset(true);
        try {
            await firebase.auth.resetPassword(email);
            toast.success('Password reset email sent to your inbox');
            setOpen(false);
        } catch (err) {
            toast.error(err.message || 'Failed to send reset email');
        } finally {
            setSendingReset(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input id="current-password" type="password" value={form.currentPassword} onChange={set('currentPassword')} className="mt-1.5" placeholder="Enter current password" />
                    </div>
                    <div>
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={form.newPassword}
                            onChange={set('newPassword')}
                            className="mt-1.5"
                            placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters, letters and numbers)`}
                        />
                    </div>
                    <div>
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input id="confirm-password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} className="mt-1.5" placeholder="Confirm new password" />
                    </div>
                    {error && (
                        <div role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded">
                            {error}
                        </div>
                    )}
                    <Button type="submit" disabled={changeMutation.isPending} className="w-full bg-[#1e3a5f] hover:bg-[#152a45]">
                        {changeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                    </Button>
                    <div className="pt-2 border-t">
                        <p className="text-sm text-slate-500 mb-3">Or send password reset email:</p>
                        <Button type="button" variant="outline" className="w-full" onClick={handleResetPassword} disabled={sendingReset}>
                            {sendingReset ? (
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
    );
}

export function PrintSignDialog({ listing, onClose, onPrint }) {
    const [size, setSize] = useState('A4');
    return (
        <Dialog open={!!listing} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Print Garage Sale Sign</DialogTitle>
                    <DialogDescription>Select the paper size for your garage sale sign</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-3">
                        {Object.entries(paperSizes).map(([key, paper]) => (
                            <label key={key} className="flex items-center p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="radio"
                                    name="paper-size"
                                    value={key}
                                    checked={size === key}
                                    onChange={(e) => setSize(e.target.value)}
                                    className="w-4 h-4"
                                />
                                <span className="ml-3 font-medium text-slate-700">{paper.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button className="bg-[#1e3a5f] hover:bg-[#152a45]" onClick={() => onPrint(listing)}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print Sign
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function StripeSetupDialog({ open, onOpenChange, creating, linking, onCreate, onLink }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Set Up Card Payments</DialogTitle>
                    <DialogDescription>How would you like to accept card payments?</DialogDescription>
                </DialogHeader>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-2">
                    <p className="text-sm text-blue-900">
                        <span className="font-semibold">✓ Note:</span> Card payments can only be accepted when you have at least one live listing active.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="border rounded-lg p-4 hover:bg-slate-50 cursor-pointer transition">
                        <h3 className="font-semibold text-sm mb-2">Create New Stripe Account</h3>
                        <p className="text-xs text-slate-600 mb-4">
                            We&apos;ll set up a new Stripe Express account for you. You&apos;ll be guided through the onboarding process.
                        </p>
                        <Button onClick={onCreate} disabled={creating} className="w-full bg-green-600 hover:bg-green-700 text-white">
                            {creating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                'Create New Account'
                            )}
                        </Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-slate-50 transition">
                        <h3 className="font-semibold text-sm mb-2">Link Existing Stripe Account</h3>
                        <p className="text-xs text-slate-600 mb-4">
                            Connect your existing Stripe account securely via Stripe OAuth.
                        </p>
                        <Button onClick={onLink} disabled={linking} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                            {linking ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Redirecting to Stripe...
                                </>
                            ) : (
                                'Connect with Stripe'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
