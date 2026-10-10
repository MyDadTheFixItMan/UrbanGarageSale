import React from 'react';
import { Printer } from 'lucide-react';
import { toast } from "sonner";
import { formatAud, formatDateTimeAU } from '@/lib/format';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { saleDate, salesTotal, paymentLabel, printSalesReport } from './salesReport';

export default function SalesHistoryDialog({ open, onOpenChange, sales, garageSales }) {
    const garageSaleName = (id) => garageSales.find((gs) => gs.id === id)?.title || 'Unknown Sale';

    const print = () => {
        if (!printSalesReport(sales)) {
            toast.error('Please allow popups to print the report');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sales History</DialogTitle>
                    <DialogDescription>All your sales transactions</DialogDescription>
                </DialogHeader>

                {sales.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-slate-600">No sales recorded yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                            <div>
                                <p className="text-xs text-slate-600 font-semibold">Total Sales</p>
                                <p className="text-xl font-bold text-slate-900">{sales.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-600 font-semibold">Total Amount</p>
                                <p className="text-xl font-bold text-green-600">{formatAud(salesTotal(sales))}</p>
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                        <th className="text-left py-2 px-3 font-semibold text-xs">Date</th>
                                        <th className="text-left py-2 px-3 font-semibold text-xs">Type</th>
                                        <th className="text-left py-2 px-3 font-semibold text-xs">Garage Sale</th>
                                        <th className="text-left py-2 px-3 font-semibold text-xs">Description</th>
                                        <th className="text-right py-2 px-3 font-semibold text-xs">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.map((sale) => (
                                        <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="py-2 px-3 text-xs text-slate-700 whitespace-nowrap">{formatDateTimeAU(saleDate(sale), 'Unknown date')}</td>
                                            <td className="py-2 px-3">{paymentLabel(sale)}</td>
                                            <td className="py-2 px-3 text-xs text-slate-700">{garageSaleName(sale.garageSaleId)}</td>
                                            <td className="py-2 px-3 text-slate-700 max-w-xs truncate">{sale.description || '-'}</td>
                                            <td className="py-2 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatAud(sale.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {sales.length > 0 && (
                        <Button onClick={print} className="bg-blue-600 hover:bg-blue-700 gap-2">
                            <Printer className="w-4 h-4" />
                            Print Report
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
