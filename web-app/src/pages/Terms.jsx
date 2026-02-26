import React, { useEffect, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';

export default function Terms() {
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
                    {/* Terms and Conditions */}
                    <div className="mb-12">
                        <h1 className="text-3xl font-bold text-[#001f3f] mb-2">Terms and Conditions</h1>
                        <p className="text-slate-600 mb-6">Urban Garage Sale</p>
                        <p className="text-sm text-slate-500 mb-6">Last updated: February 2026</p>

                        <div className="prose prose-sm max-w-none text-slate-700 space-y-4">
                            <p className="italic">Welcome to Urban Garage Sale. By accessing or using this platform, you agree to comply with and be bound by the following Terms and Conditions. Please read them carefully.</p>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">1. About the Platform</h3>
                                <p>Urban Garage Sale provides an online space where users can list garage sales and where buyers can search for nearby events. Urban Garage Sale is not involved in the transactions, negotiations, or interactions between users.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">2. Eligibility</h3>
                                <p>You must be at least 18 years old to create listings or interact with other users on the platform.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">3. User Responsibilities</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>All information in your listing must be accurate, lawful, and up to date.</li>
                                    <li>You must only post genuine garage sales that you own or have permission to promote.</li>
                                    <li>You must not upload harmful, misleading, or inappropriate content.</li>
                                    <li>You agree not to use the platform for spam, harassment, or any unlawful activity.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">4. User Generated Content</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>You retain ownership of the content you submit.</li>
                                    <li>By posting a listing, you grant Urban Garage Sale a non-exclusive, worldwide, royalty-free licence to use, display, and distribute this content for the purpose of running and promoting the platform.</li>
                                    <li>Urban Garage Sale reserves the right to remove or edit content that violates these Terms.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">5. Interactions and Transactions</h3>
                                <p>Urban Garage Sale does not monitor or guarantee:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>the accuracy of listings;</li>
                                    <li>the behaviour of sellers or buyers;</li>
                                    <li>the condition, quality, or availability of items advertised.</li>
                                </ul>
                                <p className="mt-2">Your interactions are at your own risk.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">6. Prohibited Activities</h3>
                                <p>Users must not:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>list illegal goods;</li>
                                    <li>impersonate another person;</li>
                                    <li>collect data about others without consent;</li>
                                    <li>attempt to hack, disrupt, or misuse the platform.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">7. Platform Availability</h3>
                                <p>Urban Garage Sale may update, modify, or suspend parts of the service at any time. We do not guarantee uninterrupted or error-free operation.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">8. Liability</h3>
                                <p>Urban Garage Sale is not responsible for losses, damages, disputes, or issues arising from the use of the platform. Your usage and participation are entirely at your own risk.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">9. Termination</h3>
                                <p>Urban Garage Sale may suspend or delete accounts that violate the Terms or pose risks to others.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">10. Changes to Terms</h3>
                                <p>We may update these Terms occasionally. Continued use of the platform means you accept any changes.</p>
                            </div>
                        </div>
                    </div>

                    {/* Safety Guidelines */}
                    <div className="border-t pt-12">
                        <h2 className="text-3xl font-bold text-[#001f3f] mb-2">Safety Guidelines</h2>
                        <p className="text-slate-600 mb-6">Urban Garage Sale</p>

                        <div className="prose prose-sm max-w-none text-slate-700 space-y-4">
                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">For Sellers</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Provide only the details needed to locate your sale.</li>
                                    <li>Avoid posting photos with visible house numbers or personal identifiers.</li>
                                    <li>Secure valuables and avoid leaving money unattended.</li>
                                    <li>Consider having at least one other person present during your sale.</li>
                                    <li>Post clear signage to guide buyers safely.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">For Buyers</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Respect private property and follow signage.</li>
                                    <li>Do not request entry to areas outside the sale space.</li>
                                    <li>Keep pathways and driveways clear.</li>
                                    <li>Be cautious when meeting strangers or handling cash.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">General Safety</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Report suspicious activity or fraudulent listings to Urban Garage Sale.</li>
                                    <li>Never share financial or private information with other users.</li>
                                    <li>Use common sense when attending physical locations.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
