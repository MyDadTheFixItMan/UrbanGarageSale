import React, { useEffect, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';

export default function Privacy() {
    const [promoIndex, setPromoIndex] = useState(0);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const { data: allPromotions = [] } = useQuery({
        queryKey: ['allPromotions'],
        queryFn: async () => {
            try {
                const snapshot = await firebase.firestore.collection('promotions').getDocs();
                return snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return { id: doc.id, message: data.message || '', ...data };
                });
            } catch (error) {
                console.error('Error fetching promotions:', error);
                return [];
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Rotate promotional messages every 5 seconds
    useEffect(() => {
        if (allPromotions.length === 0) return;

        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [allPromotions.length]);

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

            {/* Main Content */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-12 relative z-10">
                <div className="bg-white rounded-lg shadow-md p-8">
                    {/* Privacy Policy */}
                    <div>
                        <h1 className="text-3xl font-bold text-[#001f3f] mb-2">Privacy Policy</h1>
                        <p className="text-slate-600 mb-6">Urban Garage Sale</p>
                        <p className="text-sm text-slate-500 mb-6">Last updated: February 2026</p>

                        <div className="prose prose-sm max-w-none text-slate-700 space-y-4">
                            <p className="italic">Urban Garage Sale values your privacy. This Privacy Policy explains how your information is collected, used, and protected.</p>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">1. Information We Collect</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Listing information (sale description, postcode/suburb, date/time).</li>
                                    <li>Optional user contact details such as email (if provided voluntarily).</li>
                                    <li>Technical data such as IP address, device type, or cookies for platform optimisation.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">2. How We Use Your Information</h3>
                                <p>We use your information to:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>display and promote garage sale listings;</li>
                                    <li>improve platform performance;</li>
                                    <li>ensure safe and responsible use of the website.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">3. What We Do Not Do</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>We do not sell or trade your personal data.</li>
                                    <li>We do not collect unnecessary sensitive information.</li>
                                    <li>We do not share user data with third parties except where legally required.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">4. User Control</h3>
                                <p>You can:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>request removal of your listing;</li>
                                    <li>request correction of inaccurate details;</li>
                                    <li>request deletion of optional personal data.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">5. Data Security</h3>
                                <p>We take reasonable security measures but cannot guarantee complete protection. You should avoid including unnecessary private details in your listing.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">6. Data Sharing</h3>
                                <p>We may share information only when required by law or to investigate misuse of the platform.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">7. Cookies</h3>
                                <p>Urban Garage Sale may use cookies for functionality and analytics. You can disable cookies via your browser settings.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
