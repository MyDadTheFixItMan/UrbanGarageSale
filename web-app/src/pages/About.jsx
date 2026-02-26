import React, { useEffect, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';

export default function About() {
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
                    <h1 className="text-4xl font-bold text-[#001f3f] mb-2">About Us</h1>
                    <p className="text-slate-600 mb-8 text-lg">Urban Garage Sale</p>

                    <div className="prose prose-sm max-w-none text-slate-700 space-y-6">
                        <p>
                            Urban Garage Sale was created with one simple idea in mind: to make it easier for people to find and promote garage sales in their local area. What started as a small community concept has grown into a user-friendly online platform that connects sellers and bargain hunters across towns, suburbs, and neighbourhoods.
                        </p>

                        <div>
                            <h2 className="text-2xl font-bold text-[#001f3f] mb-3">Our Mission</h2>
                            <p>
                                To bring communities together by making garage sales more accessible, visible, and easy to discover. Whether you're clearing out unwanted items, fundraising, or simply giving things a second life, Urban Garage Sale helps you reach more people with less effort.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-[#001f3f] mb-3">What We Do</h2>
                            <ul className="list-disc list-inside space-y-2 ml-2">
                                <li>Provide a simple way for users to list their garage sales online.</li>
                                <li>Help buyers discover local sales quickly and conveniently.</li>
                                <li>Support responsible re-use by encouraging items to be passed on instead of thrown away.</li>
                                <li>Offer tools that make planning, promoting, and attending garage sales easier than ever.</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-[#001f3f] mb-3">Why We Exist</h2>
                            <p>
                                Traditional garage sales rely on word of mouth, hand-drawn signs, and luck. Urban Garage Sale brings this timeless community activity into the digital world by making it easy for people to connect, declutter, and find great deals while reducing waste.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-[#001f3f] mb-3">Our Values</h2>
                            <ul className="list-disc list-inside space-y-2 ml-2">
                                <li><strong>Community</strong> – We support local connections and neighbourly interaction.</li>
                                <li><strong>Simplicity</strong> – Easy to use, easy to find, easy to share.</li>
                                <li><strong>Sustainability</strong> – Encouraging reuse to minimise waste.</li>
                                <li><strong>Authenticity</strong> – Real people, real sales, real finds.</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-[#001f3f] mb-3">Who We Serve</h2>
                            <p className="font-semibold mb-2">Urban Garage Sale is for:</p>
                            <ul className="list-disc list-inside space-y-2 ml-2">
                                <li>Individuals hosting a garage or yard sale</li>
                                <li>People looking for second-hand bargains</li>
                                <li>Families clearing out unused items</li>
                                <li>Small communities organising local sale days</li>
                                <li>Anyone who loves recycling, upcycling, or treasure hunting</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-[#001f3f] mb-3">Our Commitment</h2>
                            <p>
                                We aim to keep the platform safe, transparent, and easy to use. As we grow, we'll continue to add features that help buyers and sellers connect more efficiently and safely.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
