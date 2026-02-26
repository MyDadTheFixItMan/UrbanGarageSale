import React, { useState } from 'react';
import { SlidersHorizontal, X, MapPin } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format, addDays, nextSaturday, nextSunday } from 'date-fns';

export default function SearchFilters({ filters, onFiltersChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [localFilters, setLocalFilters] = useState(filters);

    const saleTypes = [
        { value: 'all', label: 'All Types' },
        { value: 'garage_sale', label: 'Garage Sale' },
        { value: 'yard_sale', label: 'Yard Sale' },
        { value: 'estate_sale', label: 'Estate Sale' },
        { value: 'moving_sale', label: 'Moving Sale' },
        { value: 'multi_family', label: 'Multi-Family' },
        { value: 'clearing_sale', label: 'Clearing Sale' },
        { value: 'auction', label: 'Auction' },
        { value: 'street_sale', label: 'Street Sale' },
    ];

    const distanceOptions = [
        { value: '5', label: '5 km' },
        { value: '10', label: '10 km' },
        { value: '25', label: '25 km' },
        { value: '50', label: '50 km' },
        { value: '100', label: '100 km' },
    ];

    const datePresets = [
        { label: 'Today', getValue: () => new Date() },
        { label: 'Tomorrow', getValue: () => addDays(new Date(), 1) },
        { label: 'This Weekend', getValue: () => ({ from: nextSaturday(new Date()), to: nextSunday(new Date()) }) },
    ];

    const handlePostcodeChange = (value) => {
        const newFilters = { ...localFilters, postcode: value };
        setLocalFilters(newFilters);
        onFiltersChange(newFilters);
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...localFilters, [key]: value };
        setLocalFilters(newFilters);
    };

    const applyFilters = () => {
        onFiltersChange(localFilters);
        setIsOpen(false);
    };

    const clearFilters = () => {
        const clearedFilters = {
            postcode: '',
            distance: '25',
            saleType: 'all',
            date: null,
        };
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    const activeFilterCount = [
        localFilters.saleType !== 'all',
        localFilters.date,
        localFilters.distance !== '25',
    ].filter(Boolean).length;

    return (
        <div className="space-y-4">
            {/* Main Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Enter postcode..."
                        value={localFilters.postcode || ''}
                        onChange={(e) => handlePostcodeChange(e.target.value)}
                        className="pl-12 h-12 bg-white border-slate-200 rounded-xl text-base shadow-sm focus:ring-2 focus:ring-[#102a43]/20"
                    />
                </div>
                
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="h-12 px-4 rounded-xl border-slate-200 hover:bg-slate-50 relative"
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#102a43] text-white text-xs rounded-full flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-[#1e40af]">Filters</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="text-slate-500 hover:text-slate-700"
                                >
                                    Clear all
                                </Button>
                            </div>

                            {/* Distance */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Distance</label>
                                <Select
                                    value={localFilters.distance || '25'}
                                    onValueChange={(value) => handleFilterChange('distance', value)}
                                >
                                    <SelectTrigger className="w-full" aria-label="Select distance">
                                        <SelectValue placeholder="Select distance" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {distanceOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sale Type */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Sale Type</label>
                                <Select
                                    value={localFilters.saleType || 'all'}
                                    onValueChange={(value) => handleFilterChange('saleType', value)}
                                >
                                    <SelectTrigger className="w-full" aria-label="Select sale type">
                                        <SelectValue placeholder="Select sale type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {saleTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {datePresets.map((preset) => (
                                        <Badge
                                            key={preset.label}
                                            variant="outline"
                                            className="cursor-pointer hover:bg-slate-100"
                                            onClick={() => handleFilterChange('date', preset.getValue())}
                                        >
                                            {preset.label}
                                        </Badge>
                                    ))}
                                </div>
                                <Calendar
                                    mode="single"
                                    selected={localFilters.date}
                                    onSelect={(date) => handleFilterChange('date', date)}
                                    className="rounded-lg border"
                                />
                            </div>

                            <Button
                                onClick={applyFilters}
                                className="w-full bg-[#3b82f6] hover:bg-[#2563eb]"
                            >
                                Apply Filters
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {localFilters.saleType && localFilters.saleType !== 'all' && (
                        <Badge variant="secondary" className="gap-1 bg-slate-100">
                            {saleTypes.find(t => t.value === localFilters.saleType)?.label}
                            <X
                                className="w-3 h-3 cursor-pointer"
                                onClick={() => {
                                    handleFilterChange('saleType', 'all');
                                    onFiltersChange({ ...localFilters, saleType: 'all' });
                                }}
                            />
                        </Badge>
                    )}
                    {localFilters.date && (
                        <Badge variant="secondary" className="gap-1 bg-slate-100">
                            {format(localFilters.date, 'MMM d')}
                            <X
                                className="w-3 h-3 cursor-pointer"
                                onClick={() => {
                                    handleFilterChange('date', null);
                                    onFiltersChange({ ...localFilters, date: null });
                                }}
                            />
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}