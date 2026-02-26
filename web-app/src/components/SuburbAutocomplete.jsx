import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Loader2 } from 'lucide-react';

export default function SuburbAutocomplete({ value, onChange, onSelect, placeholder, className, allowFreeText = false, displayFormatter }) {
    const [searchText, setSearchText] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(null);
    const scriptLoadedRef = useRef(false);

    useEffect(() => {
        // Load Google Maps script if not already loaded
        if (!scriptLoadedRef.current) {
            loadGoogleMapsScript();
            scriptLoadedRef.current = true;
        }
    }, []);

    const loadGoogleMapsScript = () => {
        // @ts-ignore
        if (window.google?.maps?.places?.AutocompleteService) {
            return;
        }

        // Wait for Google Maps to load (it's in index.html)
        const checkForGoogle = setInterval(() => {
            // @ts-ignore
            if (window.google?.maps?.places?.AutocompleteService) {
                clearInterval(checkForGoogle);
            }
        }, 100);

        setTimeout(() => clearInterval(checkForGoogle), 10000);
    };

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (searchText.length < 2) {
                setSuggestions([]);
                setShowDropdown(false);
                return;
            }

            setLoading(true);
            try {
                // @ts-ignore
                if (!window.google?.maps?.places?.AutocompleteService) {
                    console.warn('Google Places not yet loaded');
                    setSuggestions([]);
                    setShowDropdown(false);
                    setLoading(false);
                    return;
                }

                // @ts-ignore
                const service = new window.google.maps.places.AutocompleteService();
                const result = await service.getPlacePredictions({
                    input: searchText,
                    componentRestrictions: { country: 'au' },
                    types: ['(regions)'],
                });

                const suggestions = (result.predictions || []).map(p => ({
                    id: p.place_id,
                    label: p.description,
                    description: p.description,
                    mainText: p.structured_formatting?.main_text,
                    secondaryText: p.structured_formatting?.secondary_text,
                }));
                
                setSuggestions(suggestions);
                setShowDropdown(suggestions.length > 0);
            } catch (error) {
                console.error('Autocomplete error:', error);
                setSuggestions([]);
                setShowDropdown(false);
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchText]);


    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setSearchText(newValue);
        setSelectedSuggestion(null);
        onChange?.(newValue);
        // Show dropdown when user starts typing again
        if (newValue.length >= 2) {
            setShowDropdown(true);
        }
    };

    const handleSelect = (suggestion) => {
        setSelectedSuggestion(suggestion);
        setSearchText(displayFormatter ? displayFormatter(suggestion) : suggestion.suburb);
        setShowDropdown(false);
        onSelect?.(suggestion);
    };

    return (
        <div className="relative">
            <div className="relative">
                <Input
                    value={searchText}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setShowDropdown(true);
                        }
                    }}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder={placeholder || "Start typing suburb..."}
                    className={className}
                    autoComplete="off"
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                )}
            </div>

            {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors border-b last:border-b-0"
                        >
                            <div className="font-medium text-slate-900">
                                {suggestion.suburb} {suggestion.state} {suggestion.postcode}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}