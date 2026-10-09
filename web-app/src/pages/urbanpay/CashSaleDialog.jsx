import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { formatAud, formatDateAU } from '@/lib/format';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

// Returns an error message for the cash sale form, or null if it can be submitted.
export function cashSaleProblem({ amount, description, garageSaleId }) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 'Please enter a valid amount';
    if (!description || !description.trim()) return 'Please enter a description';
    if (!garageSaleId) return 'Please select a garage sale';
    return null;
}

// Recorded server-side so the sale and both stats documents update atomically.
async function recordCashSale({ amount, description, garageSaleId }) {
    const currentUser = firebase.auth.getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    const token = await currentUser.getIdToken();

    const response = await apiFetch(`${API_BASE_URL}/api/urbanPayment/recordSale`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            amount: Number(amount),
            description: description.trim(),
            paymentMethod: 'cash',
            garageSaleId,
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.error || `Failed to record sale (${response.status})`);
    }
    return result.amount ?? Number(amount);
}

export default function CashSaleDialog({ open, onOpenChange, garageSales, garageSalesLoading, garageSaleId, onGarageSaleChange, onRecorded }) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [recording, setRecording] = useState(false);

    const submit = async () => {
        const problem = cashSaleProblem({ amount, description, garageSaleId });
        if (problem) {
            toast.error(problem);
            return;
        }
        setRecording(true);
        try {
            const recorded = await recordCashSale({ amount, description, garageSaleId });
            toast.success(`Cash sale recorded! ${formatAud(recorded)}`);
            setAmount('');
            setDescription('');
            onOpenChange(false);
            await onRecorded();
        } catch (error) {
            console.error('Error recording cash sale:', error);
            toast.error('Failed to record cash sale: ' + error.message);
        } finally {
            setRecording(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Cash Sale</DialogTitle>
                    <DialogDescription>
                        Enter the amount and item description for this cash transaction.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <label htmlFor="cash-sale-garage-sale" className="text-sm font-medium text-slate-700 mb-1 block">Garage Sale</label>
                        <select
                            id="cash-sale-garage-sale"
                            className={inputClass}
                            value={garageSaleId}
                            onChange={(e) => onGarageSaleChange(e.target.value)}
                            disabled={recording || garageSalesLoading}
                        >
                            <option value="">-- Select a garage sale --</option>
                            {garageSales.map((sale) => (
                                <option key={sale.id} value={sale.id}>
                                    {sale.title || 'Untitled'} {sale.date ? `(${formatDateAU(sale.date)})` : ''}
                                </option>
                            ))}
                        </select>
                        {garageSales.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">No garage sales found. Create one first.</p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="cash-sale-amount" className="text-sm font-medium text-slate-700 mb-1 block">Amount ($)</label>
                        <input
                            id="cash-sale-amount"
                            type="number"
                            placeholder="0.00"
                            className={inputClass}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={recording}
                        />
                    </div>
                    <div>
                        <label htmlFor="cash-sale-description" className="text-sm font-medium text-slate-700 mb-1 block">Item Description</label>
                        <input
                            id="cash-sale-description"
                            type="text"
                            placeholder="e.g., Vintage lamp, Books bundle, Furniture"
                            className={inputClass}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={recording}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recording}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={recording} className="bg-green-600 hover:bg-green-700">
                        {recording ? 'Recording...' : 'Record Sale'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
