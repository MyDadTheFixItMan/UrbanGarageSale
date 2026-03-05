import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { createPageUrl } from '../utils';

export default function PaymentCancelled() {
    const [searchParams] = useSearchParams();
    const saleId = searchParams.get('sale_id');

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-red-50 px-4">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Alert Icon */}
                <div className="flex justify-center">
                    <AlertCircle className="w-24 h-24 text-amber-500" strokeWidth={1.5} />
                </div>

                <h1 className="text-4xl font-bold text-amber-700">Payment Cancelled</h1>

                <p className="text-lg text-slate-600">
                    Your payment was cancelled and your listing was not published.
                </p>

                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                    <p className="text-sm text-slate-600">
                        Your draft listing has been saved. You can complete the payment later.
                    </p>
                    {saleId && (
                        <p className="text-sm text-slate-500">
                            <strong>Listing ID:</strong> {saleId}
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <Button
                        onClick={() => window.location.href = createPageUrl('CreateListing')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Try Again
                    </Button>
                    <Button
                        onClick={() => window.location.href = createPageUrl('Profile')}
                        variant="outline"
                        className="w-full"
                    >
                        Go to Profile
                    </Button>
                </div>
            </div>
        </div>
    );
}
