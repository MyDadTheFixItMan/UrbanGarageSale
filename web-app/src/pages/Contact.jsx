import React, { useEffect, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

export default function Contact() {
    const [promoIndex, setPromoIndex] = useState(0);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);

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
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => {
        if (allPromotions.length === 0) return;

        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [allPromotions.length]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.email || !formData.message) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            await firebase.entities.ContactMessage.create({
                name: formData.name,
                email: formData.email,
                message: formData.message
            });

            setFormData({
                name: '',
                email: '',
                message: ''
            });
            setShowSuccessDialog(true);
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] pb-24 md:pb-0">
            {/*Watermark removed*/}

            {/* Orange Promotional Ribbon */}
            {allPromotions.length > 0 && (
                <div className="fixed top-20 left-0 right-0 bg-[#FF9500] text-white py-3 text-center text-sm font-medium z-40 w-full">
                    {allPromotions[promoIndex]?.message}
                </div>
            )}

            {/* Main Content */}
            <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-12 relative z-10">
                <div className="bg-white rounded-lg shadow-md p-8">
                    <h1 className="text-4xl font-bold text-[#001f3f] mb-2">Contact Us</h1>
                    <p className="text-slate-600 mb-8">We'd love to hear from you! Send us a message and we'll respond as soon as possible.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-[#001f3f] mb-2">
                                Your Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9500]"
                                required
                            />
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[#001f3f] mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="your.email@example.com"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9500]"
                                required
                            />
                        </div>

                        {/* Message Field */}
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-[#001f3f] mb-2">
                                Message
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                placeholder="Tell us what's on your mind..."
                                rows={6}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF9500] resize-none"
                                required
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#FF9500] hover:bg-[#e68400] text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                            {isLoading ? 'Sending...' : 'Send Message'}
                        </Button>
                    </form>
                </div>
            </section>

            {/* Success Dialog */}
            <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-green-600">✓ Thank You!</DialogTitle>
                        <DialogDescription className="text-base pt-4">
                            Thank you for contacting us. We typically respond within 48 hours.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-4">
                        <Button
                            onClick={() => setShowSuccessDialog(false)}
                            className="w-full bg-[#FF9500] hover:bg-[#e68400]"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
