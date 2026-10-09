import React from 'react';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { AU_DATE, AU_DATE_TIME } from '@/lib/format';

function Field({ label, children }) {
    return (
        <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-base text-slate-900">{children}</p>
        </div>
    );
}

export function UserDetailsDialog({ user, onClose }) {
    return (
        <Dialog open={!!user} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>User Details</DialogTitle>
                </DialogHeader>
                {user && (
                    <div className="space-y-4 pt-4">
                        <Field label="Name">{user.full_name || 'Not provided'}</Field>
                        <Field label="Email">{user.email}</Field>
                        <Field label="Phone">{user.phone || 'Not provided'}</Field>
                        <Field label="Address">{user.address || 'Not provided'}</Field>
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="State">{user.state || 'N/A'}</Field>
                            <Field label="Postcode">{user.postcode || 'N/A'}</Field>
                            <Field label="Role">{user.role || 'user'}</Field>
                        </div>
                        <Field label="Joined">
                            {user.created_date ? format(parseISO(user.created_date), AU_DATE) : 'Unknown'}
                        </Field>
                        {user.last_login && (
                            <Field label="Last Login">{format(parseISO(user.last_login), AU_DATE_TIME)}</Field>
                        )}
                        <div className="pt-4">
                            <Button onClick={onClose} className="w-full" variant="outline">
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Grants or removes admin. Admins cannot remove their own admin role.
export function ChangeRoleDialog({ user, isSelf, onClose, onChangeRole, pending }) {
    const name = user?.full_name || user?.email;
    const isAdmin = user?.role === 'admin';
    return (
        <Dialog open={!!user} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change User Role</DialogTitle>
                    <DialogDescription>Update admin status for {name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <p className="text-slate-600">
                        Change role for <strong>{name}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-500">Current role:</p>
                        <Badge className={isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}>
                            {user?.role || 'user'}
                        </Badge>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        {isAdmin ? (
                            <Button
                                onClick={() => onChangeRole('user')}
                                disabled={pending || isSelf}
                                className="flex-1 bg-slate-500 hover:bg-slate-600"
                            >
                                {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Remove Admin
                            </Button>
                        ) : (
                            <Button
                                onClick={() => onChangeRole('admin')}
                                disabled={pending}
                                className="flex-1 bg-purple-500 hover:bg-purple-600"
                            >
                                {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Make Admin
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
