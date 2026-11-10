import React, { useEffect, useState } from 'react';
import { usePromotions } from '@/lib/usePromotions';
import { BUSINESS_ABN } from '@/lib/business';
import { CARD_FEES, describeCardFee } from '@/lib/pricing';

export default function Terms() {
    const [promoIndex, setPromoIndex] = useState(0);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const allPromotions = usePromotions();

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
                src="/logo-web.webp"
                alt=""
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
                        <p className="text-sm text-slate-500 mb-6">Last updated: November 2026</p>

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
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">5. Listing Rules</h3>
                                <p>Every listing is checked before it goes live, and so is every change to a live listing. Some checks are made by an automated system; anything it doesn't approve is reviewed by a person. Your listing won't be approved if it:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>includes firearms, ammunition, weapons, explosives or fireworks;</li>
                                    <li>includes drugs, drug paraphernalia, prescription medicines, alcohol, tobacco or vapes (vapes are prescription-only in Australia);</li>
                                    <li>is only selling a single item (Urban Garage Sale is for sales of many items);</li>
                                    <li>has fewer than two photos uploaded;</li>
                                    <li>has any field that is not filled out;</li>
                                    <li>includes live animals;</li>
                                    <li>has adult, offensive, hateful or discriminatory content in the text or photos;</li>
                                    <li>shows other people's personal details, or clearly identifiable children, in the photos;</li>
                                    <li>isn't really the type of sale selected (for example an ongoing shop, a service ad, a business promotion or a job ad);</li>
                                    <li>looks like a scam (for example it asks for deposits up front, asks for payment off the platform, or has links to other sites);</li>
                                    <li>is spam or gibberish, or doesn't match itself (for example the description names a different city from the address).</li>
                                </ul>
                                <p className="mt-2">If a listing is rejected, any listing fee is refunded as set out in section 8. If changes to a live listing are refused, the listing stays live as it was.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">6. Interactions and Transactions</h3>
                                <p>Urban Garage Sale does not monitor or guarantee:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>the accuracy of listings;</li>
                                    <li>the behaviour of sellers or buyers;</li>
                                    <li>the condition, quality, or availability of items advertised.</li>
                                </ul>
                                <p className="mt-2">Your interactions are at your own risk.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">7. Prohibited Activities</h3>
                                <p>Users must not:</p>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>list illegal goods;</li>
                                    <li>impersonate another person;</li>
                                    <li>collect data about others without consent;</li>
                                    <li>attempt to hack, disrupt, or misuse the platform.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">8. Fees and Payments</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Publishing a listing costs the fee shown before you pay (currently A$10.00). All prices are in Australian dollars and include GST.</li>
                                    <li>Listing fees are processed by Stripe. Listings are checked against the Listing Rules (section 5) before going live; if we reject your listing we refund the fee automatically to the card you paid with. Refunds usually appear within 5–10 business days.</li>
                                    <li>Urban Pay card payments are processed by Stripe and paid to the seller's own Stripe account, less a card fee, including GST, that covers Stripe's processing cost: {describeCardFee(CARD_FEES.tap_to_pay)} per Tap to Pay sale, {describeCardFee(CARD_FEES.terminal)} per card reader sale, or {describeCardFee(CARD_FEES.online)} when card details are entered in the app. Stripe's terms also apply to those payments. Cash sales have no fee.</li>
                                    <li>Nothing in this section limits any refund or remedy you are entitled to under the Australian Consumer Law.</li>
                                    {BUSINESS_ABN && <li>Urban Garage Sale ABN: {BUSINESS_ABN}.</li>}
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">9. Platform Availability</h3>
                                <p>Urban Garage Sale may update, modify, or suspend parts of the service at any time. We do not guarantee uninterrupted or error-free operation.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">10. Liability</h3>
                                <p>Urban Garage Sale is a listing platform and is not a party to sales between buyers and sellers. To the extent permitted by law, we are not liable for losses or disputes arising from those sales or from your use of the platform.</p>
                                <p className="mt-2">Nothing in these Terms excludes, restricts, or modifies rights you may have under the Australian Consumer Law (including non-excludable consumer guarantees) or any other law where those rights cannot lawfully be excluded.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">11. Termination</h3>
                                <p>Urban Garage Sale may suspend or delete accounts that violate the Terms or pose risks to others.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">12. Changes to Terms</h3>
                                <p>We may update these Terms from time to time. We will notify you by email or on the website before any material change takes effect. If you do not agree with a change, you may stop using the platform and ask us to close your account.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-[#001f3f] mt-6 mb-2">13. Governing Law</h3>
                                <p>These Terms are governed by the laws in force in Victoria, Australia. You and Urban Garage Sale submit to the non-exclusive jurisdiction of the courts of Victoria and the courts that can hear appeals from them.</p>
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
