import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { nextPromoSequence, reorderPromotions } from './adminStats';

const promotionsCollection = () => firebase.firestore.collection('promotions');

export default function PromotionsCard({ promotions }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['allPromotions'] });

    const closeForm = () => {
        setShowForm(false);
        setDraft('');
        setEditingId(null);
    };

    const saveMutation = useMutation({
        mutationFn: async (message) => {
            if (editingId) {
                await promotionsCollection().doc(editingId).set({ message }, { merge: true });
            } else {
                await promotionsCollection().add({ message, sequence: nextPromoSequence(promotions) });
            }
        },
        onSuccess: () => {
            refresh();
            closeForm();
            toast.success('Promotional message saved!');
        },
        onError: (error) => {
            toast.error(`Failed to save message: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (promoId) => promotionsCollection().doc(promoId).delete(),
        onSuccess: () => {
            refresh();
            toast.success('Promotional message deleted');
        },
    });

    const reorderMutation = useMutation({
        mutationFn: ({ index, direction }) => Promise.all(
            reorderPromotions(promotions, index, direction).map(({ id, sequence }) =>
                promotionsCollection().doc(id).set({ sequence }, { merge: true })
            )
        ),
        onSuccess: refresh,
    });

    const startEditing = (promo) => {
        setDraft(promo?.message || '');
        setEditingId(promo?.id || null);
        setShowForm(true);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Promotional Messages (Rotating every 5 seconds)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {promotions.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700 mb-3">Active Messages:</p>
                        {promotions.map((promo, index) => (
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
                                                onClick={() => reorderMutation.mutate({ index, direction: -1 })}
                                                disabled={reorderMutation.isPending}
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                title="Move up"
                                                aria-label="Move up"
                                            >
                                                ↑
                                            </Button>
                                        )}
                                        {index < promotions.length - 1 && (
                                            <Button
                                                onClick={() => reorderMutation.mutate({ index, direction: 1 })}
                                                disabled={reorderMutation.isPending}
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                title="Move down"
                                                aria-label="Move down"
                                            >
                                                ↓
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => startEditing(promo)}
                                            variant="outline"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            onClick={() => deleteMutation.mutate(promo.id)}
                                            disabled={deleteMutation.isPending}
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                                            title="Delete"
                                            aria-label="Delete"
                                        >
                                            {deleteMutation.isPending ? (
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

                {showForm ? (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label htmlFor="promo-message" className="block text-sm font-medium text-slate-700 mb-2">
                                {editingId ? 'Edit Message' : 'New Promotional Message'}
                            </label>
                            <Textarea
                                id="promo-message"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="E.g., 🎉 List your garage sale and reach hundreds of local buyers!"
                                className="min-h-[80px]"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                This message will rotate on the homepage every 5 seconds
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => saveMutation.mutate(draft)}
                                disabled={saveMutation.isPending || !draft.trim()}
                                className="bg-[#1e3a5f] hover:bg-[#152a45]"
                            >
                                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {editingId ? 'Update' : 'Add'} Message
                            </Button>
                            <Button onClick={closeForm} variant="outline">
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button onClick={() => startEditing(null)} className="bg-[#1e3a5f] hover:bg-[#152a45] w-full">
                        + Add Promotional Message
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
