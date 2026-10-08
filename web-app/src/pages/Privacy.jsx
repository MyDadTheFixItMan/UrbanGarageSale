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

    // Add default promotion if none exist
    const promotions = allPromotions.length > 0 ? allPromotions : [
        { id: 'default', message: '🎉 Welcome to Urban Garage Sale! Find amazing deals near you!' }
    ];

    // Rotate promotional messages every 5 seconds
    useEffect(() => {
        if (promotions.length === 0) return;

        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % promotions.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [promotions.length]);

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
            <div className="bg-gradient-to-r from-[#FF9500] to-[#f97316] text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full" style={{ backgroundColor: 'rgb(255, 149, 0)' }}>
                <p className="text-sm sm:text-base font-semibold">
                    {promotions[promoIndex]?.message}
                </p>
            </div>

            {/* Main Content */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-12 relative z-10">
                <div className="bg-white rounded-lg shadow-md p-8">
                    {/* Privacy Policy */}
                    <div>
                        <h1 className="text-3xl font-bold text-[#001f3f] mb-2">Privacy Policy</h1>
                        <p className="text-slate-600 mb-6">Urban Garage Sale</p>
                        <p className="text-sm text-slate-500 mb-6">Last updated: October 2026</p>

                        <div className="prose prose-sm max-w-none text-slate-700 space-y-4">
                            <p className="italic">Urban Garage Sale values your privacy. This policy explains how we collect, use, disclose and protect your personal information in line with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">1. Information We Collect</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Account details: name, email address, mobile phone number, residential address, suburb, postcode and state.</li>
                                    <li>Listing details: sale description, address, dates and times, and any photos you upload.</li>
                                    <li>Urban Pay records: amounts, descriptions and dates of sales you record. Card details are entered directly with Stripe; we never see or store card numbers.</li>
                                    <li>Stripe account status if you enable card payments (Stripe collects identity and bank details directly for its own verification).</li>
                                    <li>Messages you send us through the contact form.</li>
                                    <li>Technical data such as IP address, device type and cookies.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">2. Why We Collect It</h3>
                                <p>We use your information to:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>create and secure your account, including SMS verification and two-factor authentication;</li>
                                    <li>publish and show garage sale listings on the map and in search;</li>
                                    <li>process listing fees and Urban Pay card payments;</li>
                                    <li>respond to your enquiries and send service emails (such as listing approvals);</li>
                                    <li>prevent misuse of the platform and meet our legal obligations.</li>
                                </ul>
                                <p className="mt-2">If you do not provide this information, we may not be able to create your account or publish your listing.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">3. Who We Share It With</h3>
                                <p>We do not sell or trade your personal information. We share it only with service providers who help us run the platform, and where required by law:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li><strong>Google (Firebase and Google Maps)</strong> – account login, data storage, photo storage and address lookup;</li>
                                    <li><strong>Stripe</strong> – listing fee and card payment processing, and seller account verification;</li>
                                    <li><strong>Twilio SendGrid</strong> – sending service emails;</li>
                                    <li><strong>Vercel</strong> – hosting our payment services.</li>
                                </ul>
                                <p className="mt-2">Listing details you choose to publish (including the sale address) are visible to the public.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">4. Overseas Disclosure</h3>
                                <p>Our service providers may store or process your information outside Australia, including in the United States and other countries where they operate data centres. We take reasonable steps to ensure these providers handle your information consistently with the APPs.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">5. Access, Correction and Deletion</h3>
                                <p>You can update most details in your Profile at any time. You can also ask us to:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>give you access to the personal information we hold about you;</li>
                                    <li>correct inaccurate information;</li>
                                    <li>delete your account and listings.</li>
                                </ul>
                                <p className="mt-2">When an account is deleted we remove the profile, listings, saved listings, sales records and contact messages. Payment records are kept in de-identified form where we are required to keep financial records by law.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">6. Data Security and Breaches</h3>
                                <p>We take reasonable steps to protect your information from misuse, loss and unauthorised access, including encrypted connections, access controls and two-factor authentication. No system is completely secure, so please avoid including unnecessary private details in your listing.</p>
                                <p className="mt-2">If a data breach is likely to result in serious harm, we will notify affected individuals and the OAIC as required by the Notifiable Data Breaches scheme.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">7. Cookies</h3>
                                <p>Urban Garage Sale uses cookies and similar browser storage to keep you signed in and remember your preferences. You can disable cookies in your browser settings, but some features may stop working.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">8. Complaints and Contact</h3>
                                <p>To request access or correction of personal information, or to make a privacy complaint, contact Urban Garage Sale at support@urbangaragesales.com.au.</p>
                                <p className="mt-2">We aim to respond within 30 days. If you are not satisfied with our response, you may contact the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au or on 1300 363 992.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
