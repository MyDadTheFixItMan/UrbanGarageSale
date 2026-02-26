import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { MapPin, Clock, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const customIcon = new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3b82f6, #60a5fa);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    ">
        <div style="
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            transform: rotate(45deg);
        "></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

function MapUpdater({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, zoom);
        }
    }, [center, zoom, map]);
    return null;
}

export default function SaleMap({ sales, center, zoom = 12, onSaleClick }) {
    const defaultCenter = center || [-33.8688, 151.2093]; // Sydney default

    return (
        <div className="w-full h-full rounded-2xl overflow-hidden shadow-lg">
            <MapContainer
                center={defaultCenter}
                zoom={zoom}
                className="w-full h-full"
                style={{ minHeight: '400px' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapUpdater center={center} zoom={zoom} />
                
                {sales.map((sale) => (
                    sale.latitude && sale.longitude && (
                        <Marker
                            key={sale.id}
                            position={[sale.latitude, sale.longitude]}
                            icon={customIcon}
                        >
                            <Popup className="sale-popup">
                                <div className="p-2 min-w-[200px]">
                                    <h3 className="font-semibold text-[#1e40af] text-sm mb-2">
                                        {sale.title}
                                    </h3>
                                    <div className="space-y-1 text-xs text-slate-600 mb-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3" />
                                            <span>{format(new Date(sale.start_date), 'MMM d')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            <span>{sale.start_time} - {sale.end_time}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate">{sale.address}</span>
                                        </div>
                                    </div>
                                    <Link to={createPageUrl(`ListingDetails?id=${sale.id}`)}>
                                        <Button size="sm" className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-xs">
                                            View Details
                                        </Button>
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>
        </div>
    );
}