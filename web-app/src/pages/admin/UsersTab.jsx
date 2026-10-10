import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, X, Eye, Trash2, ShieldCheck, Search, Users } from 'lucide-react';
import { toast } from "sonner";
import { format, parseISO } from 'date-fns';
import { firebase } from '@/api/firebaseClient';
import { AU_STATES } from '@/api/firebase/entities';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AU_DATE, AU_DATE_TIME } from '@/lib/format';
import { splitUsersByProfile, isFullPostcode } from './adminStats';
import ConfirmDeleteDialog from './ConfirmDialog';
import { UserDetailsDialog, ChangeRoleDialog } from './UserDialogs';
import { ADMIN_KEY, usePagedQuery, LoadMoreButton, ListLoading } from './usePagedQuery';

export default function UsersTab({ currentUserEmail }) {
    const queryClient = useQueryClient();
    const [stateFilter, setStateFilter] = useState('all');
    const [postcodeFilter, setPostcodeFilter] = useState('');
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToPromote, setUserToPromote] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);

    // Filters run in the query; the postcode only once all four digits are typed.
    const state = stateFilter === 'all' ? undefined : stateFilter;
    const postcode = isFullPostcode(postcodeFilter) ? postcodeFilter : undefined;
    const paged = usePagedQuery(['users', state, postcode], (cursor) =>
        firebase.entities.User.page({ state, postcode, cursor }));
    // Incomplete sign-ups are only found among the users loaded so far.
    const { complete: filteredUsers, incomplete: incompleteUsers } = useMemo(
        () => splitUsersByProfile(paged.items), [paged.items]);

    const refreshUsers = () => queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });

    const deleteUserMutation = useMutation({
        mutationFn: (userId) => firebase.entities.User.delete(userId),
        onSuccess: async () => {
            await refreshUsers();
            setUserToDelete(null);
            toast.success('User deleted successfully');
        },
        onError: (error) => {
            toast.error('Failed to delete user: ' + error.message);
        },
    });

    const cleanupMutation = useMutation({
        mutationFn: async () => {
            if (incompleteUsers.length === 0) {
                throw new Error('No incomplete users to clean up');
            }
            await Promise.all(incompleteUsers.map((u) => firebase.entities.User.delete(u.id)));
            return incompleteUsers.length;
        },
        onSuccess: async (count) => {
            await refreshUsers();
            toast.success(`Successfully deleted ${count} incomplete user(s)`);
        },
        onError: (error) => {
            toast.error('Failed to clean up incomplete users: ' + error.message);
        },
    });

    const changeRoleMutation = useMutation({
        mutationFn: ({ userId, newRole }) => firebase.entities.User.update(userId, { role: newRole }),
        onSuccess: () => {
            refreshUsers();
            setUserToPromote(null);
            toast.success('User role updated successfully');
        },
        onError: (error) => {
            toast.error('Failed to update user role: ' + error.message);
        },
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Registered Users ({filteredUsers.length}{paged.hasMore ? '+' : ''})
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap">
                        <Select value={stateFilter} onValueChange={setStateFilter}>
                            <SelectTrigger className="w-32" aria-label="Filter users by state">
                                <SelectValue placeholder="All States" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All States</SelectItem>
                                {AU_STATES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Postcode..."
                                aria-label="Filter users by postcode"
                                inputMode="numeric"
                                maxLength={4}
                                value={postcodeFilter}
                                onChange={(e) => setPostcodeFilter(e.target.value.trim())}
                                className="pl-9 w-32"
                            />
                        </div>
                        {incompleteUsers.length > 0 && (
                            <Button
                                onClick={() => cleanupMutation.mutate()}
                                disabled={cleanupMutation.isPending}
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                            >
                                {cleanupMutation.isPending ? (
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
                {paged.isLoading ? (
                    <ListLoading />
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No users found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredUsers.map((u) => (
                            <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
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
                                            <span>• Last login: {format(parseISO(u.last_login), AU_DATE_TIME)}</span>
                                        )}
                                        {!u.last_login && u.created_date && (
                                            <span>• Joined: {format(parseISO(u.created_date), AU_DATE)}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedUser(u)}
                                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                        title="View user details"
                                        aria-label="View user details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setUserToPromote(u)}
                                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                        aria-label="Change user role"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                    </Button>
                                    {u.email !== currentUserEmail && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setUserToDelete(u)}
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                            aria-label="Delete user"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <LoadMoreButton paged={paged} />
            </CardContent>

            <UserDetailsDialog user={selectedUser} onClose={() => setSelectedUser(null)} />

            <ConfirmDeleteDialog
                open={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                title="Delete User"
                description="Permanently remove this user from the system"
                itemName={userToDelete?.full_name || userToDelete?.email}
                onConfirm={() => deleteUserMutation.mutate(userToDelete.id)}
                pending={deleteUserMutation.isPending}
            />

            <ChangeRoleDialog
                user={userToPromote}
                isSelf={userToPromote?.email === currentUserEmail}
                onClose={() => setUserToPromote(null)}
                onChangeRole={(newRole) => changeRoleMutation.mutate({ userId: userToPromote.id, newRole })}
                pending={changeRoleMutation.isPending}
            />
        </Card>
    );
}
