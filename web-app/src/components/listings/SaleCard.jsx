import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { MapPin, Clock, ChevronRight, Tag } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format, isToday, isTomorrow } from 'date-fns';

const saleTypeLabels = {
    garage_sale: 'Garage Sale',
    yard_sale: 'Yard Sale',
    estate_sale: 'Estate Sale',
    moving_sale: 'Moving Sale',
    multi_family: 'Multi-Family',
    clearing_sale: 'Clearing Sale',
    auction: 'Auction',
    street_sale: 'Street Sale',
};

export default function SaleCard({ sale }) {
    const getDateLabel = () => {
        const startDate = new Date(sale.start_date);
        if (isToday(startDate)) return 'Today';
        if (isTomorrow(startDate)) return 'Tomorrow';
        return format(startDate, 'EEE, MMM d');
    };

    return (
        <Link to={createPageUrl(`ListingDetails?id=${sale.id}`)}>
            <div className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300">
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {sale.photos && sale.photos.length > 0 ? (
                        <img
                            src={sale.photos[0]}
                            alt={sale.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                            <Tag className="w-12 h-12 text-slate-300" />
                        </div>
                    )}
                    
                    {/* Date Badge */}
                    <div className="absolute top-3 left-3">
                        <Badge className="bg-white/95 text-[#1e40af] backdrop-blur-sm shadow-sm font-medium">
                            {getDateLabel()}
                        </Badge>
                    </div>

                    {/* Sale Type */}
                    {sale.sale_type && (
                        <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="bg-[#3b82f6]/90 text-white backdrop-blur-sm">
                                {saleTypeLabels[sale.sale_type]}
                            </Badge>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="font-semibold text-[#1e40af] text-lg mb-2 line-clamp-1 group-hover:text-[#3b82f6] transition-colors">
                        {sale.title}
                    </h3>
                    
                    <div className="space-y-2 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{sale.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>{sale.start_time} - {sale.end_time}</span>
                        </div>
                    </div>

                    {/* View Details */}
                    <div className="mt-4 flex items-center text-[#3b82f6] text-sm font-medium group-hover:text-[#2563eb] transition-colors">
                        <span>View Details</span>
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>
        </Link>
    );
}