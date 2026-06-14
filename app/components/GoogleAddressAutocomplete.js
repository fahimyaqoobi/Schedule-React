"use client";

import React, { useState, useEffect } from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getZipCode,
} from "use-places-autocomplete";
import { useLoadScript } from "@react-google-maps/api";

const libraries = ["places"];

export default function GoogleAddressAutocomplete({ onAddressSelect, apiKey }) {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: apiKey || "dummy-key",
        libraries,
    });

    // If apiKey is not provided yet, fallback to manual entry
    if (!apiKey) {
        return (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm">
                <p className="font-bold mb-2">Google Maps API Key Required</p>
                <p>The system admin needs to provide a Google Maps API Key in the settings to enable address autocomplete.</p>
                <div className="mt-4 flex flex-col gap-3">
                    <input type="text" placeholder="Manual Street Address" className="w-full p-3 border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" onChange={e => onAddressSelect({ address1: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="City" className="w-full p-3 border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" onChange={e => onAddressSelect({ city: e.target.value })} />
                        <input type="text" placeholder="Postal Code" className="w-full p-3 border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" onChange={e => onAddressSelect({ postalCode: e.target.value })} />
                    </div>
                </div>
            </div>
        );
    }

    if (loadError) return <div className="text-red-500 font-bold p-4 bg-red-50 rounded-xl">Error loading Google Maps API</div>;
    if (!isLoaded) return <div className="text-slate-400 font-bold p-4 animate-pulse">Loading address engine...</div>;

    return <PlacesAutocomplete onAddressSelect={onAddressSelect} />;
}

const PlacesAutocomplete = ({ onAddressSelect }) => {
    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            // Optional: Bias to a specific country (e.g. Canada)
            componentRestrictions: { country: "ca" },
        },
        debounce: 300,
    });

    const handleSelect = async (val) => {
        setValue(val, false);
        clearSuggestions();

        try {
            const results = await getGeocode({ address: val });
            const result = results[0];
            
            let address1 = "";
            let city = "";
            let state = "";
            let postalCode = "";
            let country = "";

            // Parse address components
            result.address_components.forEach(component => {
                const types = component.types;
                if (types.includes("street_number")) {
                    address1 += component.long_name + " ";
                }
                if (types.includes("route")) {
                    address1 += component.long_name;
                }
                if (types.includes("locality")) {
                    city = component.long_name;
                }
                if (types.includes("administrative_area_level_1")) {
                    state = component.short_name;
                }
                if (types.includes("postal_code")) {
                    postalCode = component.long_name;
                }
                if (types.includes("country")) {
                    country = component.long_name;
                }
            });

            // If postal code is missing from the main geocode, sometimes getZipCode helps
            if (!postalCode) {
                 try {
                     postalCode = await getZipCode(result);
                 } catch(e) {
                     // Zip code not found
                 }
            }

            onAddressSelect({
                address1: address1.trim() || val.split(",")[0],
                city,
                state,
                postalCode,
                country
            });

        } catch (error) {
            console.error("Error: ", error);
        }
    };

    return (
        <div className="relative w-full">
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!ready}
                placeholder="Start typing your address..."
                className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold text-slate-800 text-lg shadow-sm"
            />
            {status === "OK" && (
                <ul className="absolute z-50 w-full bg-white mt-2 border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {data.map(({ place_id, description }) => (
                        <li 
                            key={place_id} 
                            onClick={() => handleSelect(description)}
                            className="p-4 hover:bg-blue-50 cursor-pointer transition-colors font-medium text-slate-700"
                        >
                            {description}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
