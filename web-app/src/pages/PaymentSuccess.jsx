import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { createPageUrl } from '../utils';

export default function PaymentSuccess() {
    const [searchParams] = useSearchParams();
    const saleId = searchParams.get('sale_id');
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        // Auto-redirect to profile after 3 seconds
        const timer = setTimeout(() => {
            window.location.href = createPageUrl('Profile');
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-4">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Success Icon */}
                <div className="flex justify-center">
                    <CheckCircle className="w-24 h-24 text-green-500" strokeWidth={1.5} />
                </div>

                <h1 className="text-4xl font-bold text-green-700">Payment Received!</h1>

                <p className="text-lg text-slate-600">
                    Your garage sale listing has been successfully submitted for approval.
                </p>

                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2">
                    <p className="text-sm text-slate-500">
                        <strong>Listing ID:</strong> {saleId || 'N/A'}
                    </p>
                    {sessionId && (
                        <p className="text-sm text-slate-500">
                            <strong>Session:</strong> {sessionId.substring(0, 20)}...
                        </p>
                    )}
                </div>

                <p className="text-slate-600">
                    You'll be redirected to your profile in a few seconds...
                </p>

                <Button
                    onClick={() => window.location.href = createPageUrl('Profile')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                    <Home className="w-4 h-4 mr-2" />
                    Go to Profile Now
                </Button>
            </div>
        </div>
    );
}
