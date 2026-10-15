import React from 'react';
import { addDays, format } from 'date-fns';
import { MapPin, Calendar, Info } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';
import { SALE_TYPES, STATES, MAX_SALE_DAYS } from './listingForm';

// The create/edit listing form's sections. Each takes the form values and onChange(field, value).

export function FormSection({ title, icon: Icon, children, className = 'mb-6' }) {
    return (
        <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className={`text-lg font-semibold text-[#1e3a5f] ${className} flex items-center gap-2`}>
                {Icon && <Icon className="w-5 h-5" />}
                {title}
            </h2>
            {children}
        </section>
    );
}

export function BasicInfoSection({ form, onChange }) {
    return (
        <FormSection title="Basic Information">
            <div className="space-y-4">
                <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                        id="title"
                        placeholder="e.g., Moving Sale - Everything Must Go!"
                        value={form.title}
                        onChange={(e) => onChange('title', e.target.value)}
                        className="mt-1.5"
                    />
                </div>

                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Tell buyers what items you'll be selling..."
                        value={form.description}
                        onChange={(e) => onChange('description', e.target.value)}
                        className="mt-1.5 min-h-[120px]"
                    />
                </div>

                <div>
                    <Label htmlFor="sale_type">Sale Type</Label>
                    <Select value={form.sale_type} onValueChange={(value) => onChange('sale_type', value)}>
                        <SelectTrigger className="mt-1.5" aria-label="Select sale type">
                            <SelectValue placeholder="Choose a sale type" />
                        </SelectTrigger>
                        <SelectContent>
                            {SALE_TYPES.map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </FormSection>
    );
}

export function LocationSection({ form, onChange, locked }) {
    const handleSelect = (place) => {
        if (!place.address) return;
        onChange('address', place.address);
        onChange('suburb', place.suburb);
        onChange('postcode', place.postcode);
        onChange('state', place.state);
        onChange('latitude', place.latitude);
        onChange('longitude', place.longitude);
    };

    return (
        <FormSection title="Location" icon={MapPin}>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="address">Street Address *</Label>
                    <GooglePlacesAutocomplete
                        id="address"
                        disabled={locked}
                        value={form.address || ''}
                        onChange={(val) => onChange('address', val)}
                        onSelect={handleSelect}
                        placeholder="123 Main Street, Suburb NSW 2000"
                        className="mt-1.5"
                    />
                </div>

                <div>
                    <Label htmlFor="suburb">Suburb & Postcode</Label>
                    <div className="grid grid-cols-2 gap-4 mt-1.5">
                        <Input id="suburb" value={form.suburb || ''} placeholder="Suburb (auto-filled)" readOnly />
                        <Input id="postcode" value={form.postcode || ''} placeholder="Postcode (auto-filled)" readOnly />
                    </div>
                </div>

                <div className="mt-4">
                    <Label htmlFor="state">State</Label>
                    <select
                        id="state"
                        value={form.state || ''}
                        onChange={(e) => onChange('state', e.target.value)}
                        className="mt-1.5 border rounded px-3 py-2 w-full"
                        disabled={!!form.state}
                    >
                        <option value="">Select State</option>
                        {STATES.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>
        </FormSection>
    );
}

function DateTimeField({ id, label, type, value, onChange, locked, ...props }) {
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(id, e.target.value)}
                className="mt-1.5"
                disabled={locked}
                {...props}
            />
        </div>
    );
}

export function DateTimeSection({ form, onChange, locked }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const lastDay = form.start_date ? format(addDays(new Date(form.start_date), MAX_SALE_DAYS - 1), 'yyyy-MM-dd') : undefined;

    return (
        <FormSection title="Date & Time" icon={Calendar} className="mb-2">
            {locked && (
                <p className="text-xs text-slate-500 italic text-center mb-4">Cannot be changed once listing has been made active</p>
            )}
            <div className={!locked ? "mt-4" : ""}></div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <DateTimeField id="start_date" label="Start Date *" type="date" value={form.start_date}
                        onChange={onChange} locked={locked} min={today} />
                    <DateTimeField id="end_date" label="End Date *" type="date" value={form.end_date}
                        onChange={onChange} locked={locked} min={form.start_date || today} max={lastDay} />
                </div>

                <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    Maximum {MAX_SALE_DAYS} consecutive days per listing
                </p>

                <div className="grid grid-cols-2 gap-4">
                    <DateTimeField id="start_time" label="Daily Start Time" type="time" value={form.start_time}
                        onChange={onChange} locked={locked} />
                    <DateTimeField id="end_time" label="Daily End Time" type="time" value={form.end_time}
                        onChange={onChange} locked={locked} />
                </div>
            </div>
        </FormSection>
    );
}
