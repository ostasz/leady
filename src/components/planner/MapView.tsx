import React, { useState, useEffect } from 'react';
import { Lead } from './types';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin, Sparkles, Navigation } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface MapViewProps {
    weekStart: Date;
    scheduledLeads: Record<string, Lead[]>;
}

// Internal component that consumes the APIProvider context
const MapContent: React.FC<MapViewProps> = ({ weekStart, scheduledLeads }) => {
    const { user } = useAuth();
    // Determine which day to show.
    // Logic: Default to "Today" if it falls within the current week view (Mon-Fri).
    // Otherwise (e.g. weekend or different week), default to Monday of that week.
    const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        // Check if today is in the current view (Mon-Fri)
        const days = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));
        const isTodayVisible = days.some(d => format(d, 'yyyy-MM-dd') === todayStr);

        return isTodayVisible ? todayStr : format(weekStart, 'yyyy-MM-dd');
    });

    // Ensure selectedDateKey updates when user changes the week (Navigation)
    useEffect(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const days = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));

        // Is the currently selected date still visible in the NEW week?
        const isCurrentSelectionVisible = days.some(d => format(d, 'yyyy-MM-dd') === selectedDateKey);

        if (!isCurrentSelectionVisible) {
            // New week loaded. 
            // If "Real Today" is in this new week, select it.
            // Otherwise select the first day (Monday).
            const isTodayInNewWeek = days.some(d => format(d, 'yyyy-MM-dd') === todayStr);
            if (isTodayInNewWeek) {
                setSelectedDateKey(todayStr);
            } else {
                setSelectedDateKey(format(weekStart, 'yyyy-MM-dd'));
            }
        }
    }, [weekStart]);

    const [isLoading, setIsLoading] = useState(false);
    const [dailyRouteOrder, setDailyRouteOrder] = useState<Record<string, string[]>>({});

    const [startLocation, setStartLocation] = useState('Biuro (Warszawa)');
    const [endLocation, setEndLocation] = useState('Biuro (Warszawa)');


    // Fetch settings from API when date changes
    useEffect(() => {
        if (!user) return;

        let isMounted = true;
        setIsLoading(true);

        async function fetchSettings() {
            try {
                const token = await user?.getIdToken();
                const res = await fetch(`/api/planner/settings?date=${selectedDateKey}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setStartLocation(data.start || 'Biuro (Warszawa)');
                        setEndLocation(data.end || 'Biuro (Warszawa)');

                        // Update order if present
                        if (data.order && Array.isArray(data.order)) {
                            setDailyRouteOrder(prev => ({ ...prev, [selectedDateKey]: data.order }));
                        } else {
                            // Clear order if not found (or empty)
                            setDailyRouteOrder(prev => {
                                const next = { ...prev };
                                delete next[selectedDateKey];
                                return next;
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch settings', e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchSettings();

        return () => { isMounted = false; };
    }, [selectedDateKey, user]);

    // Debounced Auto-Save Effect
    useEffect(() => {
        if (!user || isLoading) return;

        const timer = setTimeout(async () => {
            try {
                const token = await user.getIdToken();
                const currentOrder = dailyRouteOrder[selectedDateKey];
                await fetch('/api/planner/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        date: selectedDateKey,
                        start: startLocation,
                        end: endLocation,
                        order: currentOrder
                    })
                });
            } catch (e) {
                console.error('Failed to auto-save settings', e);
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timer);
    }, [startLocation, endLocation, dailyRouteOrder, selectedDateKey, isLoading, user]);


    // Handlers to update specific day settings
    const handleStartChange = (val: string) => {
        setStartLocation(val);
    };

    const handleEndChange = (val: string) => {
        setEndLocation(val);
    };

    const [optimizedLeads, setOptimizedLeads] = useState<Lead[]>([]);

    const map = useMap();
    const maps = useMapsLibrary('maps');
    const geocoding = useMapsLibrary('geocoding');
    const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
    const [routesLibrary, setRoutesLibrary] = useState<google.maps.RoutesLibrary | null>(null);

    // Initialize services
    useEffect(() => {
        if (!routesLibrary && maps) {
            import('@vis.gl/react-google-maps').then(async () => {
                setRoutesLibrary(await google.maps.importLibrary("routes") as google.maps.RoutesLibrary);
            });
        }
    }, [maps, routesLibrary]);

    useEffect(() => {
        if (!directionsService && routesLibrary) {
            setDirectionsService(new window.google.maps.DirectionsService());
        }
        if (!directionsRenderer && maps) {
            setDirectionsRenderer(new window.google.maps.DirectionsRenderer({ suppressMarkers: true }));
        }
    }, [routesLibrary, maps, directionsService, directionsRenderer]);

    useEffect(() => {
        if (directionsRenderer && map) {
            directionsRenderer.setMap(map);
        }
    }, [directionsRenderer, map]);


    const [geocodingErrors, setGeocodingErrors] = useState<Record<string, boolean>>({});

    // When optimizedLeads change, try to fill in missing coordinates
    useEffect(() => {
        if (!geocoding || optimizedLeads.length === 0) return;

        const geocoder = new window.google.maps.Geocoder();
        let isMounted = true;

        async function enrichLeads() {
            const enriched = await Promise.all(optimizedLeads.map(async (lead) => {
                if ((lead.latitude && lead.longitude) || !lead.address) return lead;

                // Geocode if missing coords
                try {
                    const res = await geocoder.geocode({ address: lead.address });
                    if (res.results[0]) {
                        const loc = res.results[0].geometry.location;
                        return { ...lead, latitude: loc.lat(), longitude: loc.lng() };
                    }
                } catch (e) {
                    console.warn(`Geocoding failed for ${lead.companyName}`, e);
                    if (isMounted) {
                        setGeocodingErrors(prev => ({ ...prev, [lead.id]: true }));
                    }
                }
                return lead;
            }));

            if (!isMounted) return;

            // Only update if different
            const hasChanges = enriched.some((l, i) =>
                l.latitude !== optimizedLeads[i].latitude || l.longitude !== optimizedLeads[i].longitude
            );

            if (hasChanges) {
                setOptimizedLeads(enriched);
            }
        }

        enrichLeads();

        return () => { isMounted = false; };
    }, [geocoding, optimizedLeads.length, selectedDateKey]);

    // Generate a stable hash for dependencies to prevent useEffect errors
    const leadsHash = optimizedLeads.map(l => l.id).join(',');

    // Update Route Line
    useEffect(() => {
        if (!directionsService || !directionsRenderer) return;
        if (!map) return;
        directionsRenderer.setMap(map);

        const timer = setTimeout(() => {
            // Filter valid leads for waypoints
            const validLeads = optimizedLeads.filter(l => (l.latitude && l.longitude) || (l.address && !geocodingErrors[l.id]));

            // We need at least 1 lead to make a meaningful route between Start and End
            if (validLeads.length === 0 && (!startLocation || !endLocation)) {
                directionsRenderer.setMap(null);
                return;
            }

            const getPoint = (lead: Lead) => {
                if (lead.latitude && lead.longitude) {
                    return { lat: lead.latitude, lng: lead.longitude };
                }
                return lead.address as string;
            };

            // Origin and Destination from Input State
            // Use current state values which serve as the source of truth for the current view
            const origin = startLocation;
            const destination = endLocation;

            const waypoints = validLeads.map(l => ({
                location: getPoint(l),
                stopover: true
            }));

            directionsService.route({
                origin,
                destination,
                waypoints,
                travelMode: window.google.maps.TravelMode.DRIVING,
            }, (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                    try {
                        directionsRenderer.setDirections(result);
                    } catch (e) {
                        console.error('Error setting directions:', e);
                    }
                } else {
                    console.warn('Directions request failed due to ' + status); // warn instead of error to reduce alarm
                }
            });
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [directionsService, directionsRenderer, leadsHash, startLocation, endLocation, map, geocodingErrors]);

    const days = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));

    // When date changes, reset optimized list to raw scheduled list OR saved order
    useEffect(() => {
        const rawLeads = scheduledLeads[selectedDateKey] || [];
        const savedOrder = dailyRouteOrder[selectedDateKey];

        if (savedOrder && savedOrder.length > 0) {
            // Sort raw leads according to saved ID order
            const orderedLeads: Lead[] = [];
            // Fix: Use window.Map to avoid conflict with imported Map component
            const leadMap = new window.Map(rawLeads.map(l => [l.id, l]));

            savedOrder.forEach(id => {
                if (leadMap.has(id)) {
                    orderedLeads.push(leadMap.get(id)!);
                    leadMap.delete(id);
                }
            });

            // Add any remaining leads that weren't in the saved order
            leadMap.forEach(lead => orderedLeads.push(lead));

            setOptimizedLeads(orderedLeads);
        } else {
            setOptimizedLeads(rawLeads);
        }
    }, [selectedDateKey, scheduledLeads, dailyRouteOrder]);


    const [optimizationSuccess, setOptimizationSuccess] = useState(false);

    const handleOptimize = async () => {
        // Mock optimization: Reverse for now, but imagine it doing smart things
        const leads = [...(scheduledLeads[selectedDateKey] || [])];
        const optimized = [...leads].reverse();
        setOptimizedLeads(optimized);

        // Save the new order - this updates state, which triggers the auto-save effect
        setDailyRouteOrder(prev => ({
            ...prev,
            [selectedDateKey]: optimized.map(l => l.id)
        }));

        setOptimizationSuccess(true);
        setTimeout(() => setOptimizationSuccess(false), 3000);
    };

    const handleExportToGoogleMaps = () => {
        const validLeads = optimizedLeads.filter(l => (l.latitude && l.longitude) || l.address);
        if (validLeads.length === 0 && !startLocation && !endLocation) return;

        const getParam = (lead: Lead) => {
            if (lead.latitude && lead.longitude) return `${lead.latitude},${lead.longitude}`;
            return encodeURIComponent(lead.address || '');
        }

        const origin = encodeURIComponent(startLocation || 'Warszawa');
        const destination = encodeURIComponent(endLocation || 'Warszawa');
        const waypoints = validLeads.map(getParam).join('|');

        // Google Maps Directions API format
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const currentLeads = optimizedLeads;

    // Default Warsaw center
    const defaultCenter = { lat: 52.2297, lng: 21.0122 };

    return (
        <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
            {/* Left Sidebar: Itinerary */}
            <div className="w-1/3 min-w-[350px] bg-white border-r border-gray-200 flex flex-col">
                {/* Day Selector */}
                <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-hide">
                    {days.map(date => {
                        const dateKey = format(date, 'yyyy-MM-dd');
                        const isSelected = dateKey === selectedDateKey;
                        const count = (scheduledLeads[dateKey] || []).length;
                        return (
                            <button
                                key={dateKey}
                                onClick={() => setSelectedDateKey(dateKey)}
                                className={`
                                    flex-1 py-3 text-center min-w-[70px] border-b-2 transition-colors
                                    ${isSelected ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:bg-gray-50'}
                                `}
                            >
                                <div className="text-xs font-medium text-gray-500 uppercase">{format(date, 'EEE', { locale: pl })}</div>
                                <div className={`font-bold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {format(date, 'd.MM')}
                                </div>
                                {count > 0 && (
                                    <div className="text-[10px] text-gray-400 mt-1">{count} pkt</div>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Route Controls */}
                <div className="p-4 space-y-4 border-b border-gray-100">
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Początek trasy</label>
                            <input
                                type="text"
                                value={startLocation}
                                onChange={(e) => handleStartChange(e.target.value)}
                                className="w-full text-sm font-medium text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Koniec trasy</label>
                            <input
                                type="text"
                                value={endLocation}
                                onChange={(e) => handleEndChange(e.target.value)}
                                className="w-full text-sm font-medium text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleOptimize}
                            className="flex-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 text-white py-2 rounded-lg font-medium shadow-lg shadow-purple-500/50 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                            <Sparkles size={18} />
                            Ułóż z AI
                        </button>

                        <button
                            onClick={handleExportToGoogleMaps}
                            className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center transform hover:scale-105"
                            title="Eksportuj do Google Maps"
                        >
                            <Navigation size={18} />
                        </button>
                    </div>
                </div>

                {/* Itinerary List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {currentLeads.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">
                            <p>Brak zaplanowanych spotkań na ten dzień.</p>
                            <p className="text-sm mt-2">Przeciągnij leady w widoku kalendarza.</p>
                        </div>
                    ) : (
                        currentLeads.map((lead, idx) => (
                            <div key={lead.id} className="flex gap-3 items-start">
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                                        {idx + 1}
                                    </div>
                                    {idx < currentLeads.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1 min-h-[20px]" />}
                                </div>
                                <div className="pb-4 pt-0.5 w-full">
                                    <div className="font-semibold text-gray-800 text-sm leading-tight">{lead.companyName}</div>

                                    <div className="mt-1 flex flex-col gap-0.5">
                                        <div className="text-xs text-gray-500 truncate">{lead.address}</div>
                                        {/* City Logic - Inline for MapView since it's just display */}
                                        {(() => {
                                            if (!lead.address) return null;
                                            const zipMatch = lead.address.match(/\d{2}-\d{3}\s+([^\,]+)/);
                                            let city = '';
                                            if (zipMatch && zipMatch[1]) city = zipMatch[1].trim();
                                            else {
                                                const parts = lead.address.split(',');
                                                if (parts.length > 1) {
                                                    const last = parts[parts.length - 1].trim();
                                                    if ((last.toLowerCase() === 'polska' || last.toLowerCase() === 'poland') && parts.length > 2) {
                                                        city = parts[parts.length - 2].trim();
                                                    } else {
                                                        city = last;
                                                    }
                                                }
                                            }

                                            // Only show if different from first part of address (simple heuristic check)
                                            if (city && !lead.address.startsWith(city)) {
                                                return <div className="text-[11px] font-semibold text-gray-700">{city}</div>;
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    {/* Opening Hours */}
                                    <div className="text-[10px] mt-1">
                                        {(() => {
                                            if (!lead.openingHours || lead.openingHours.length === 0) {
                                                return <span className="text-gray-900 font-medium">Brak danych</span>;
                                            }

                                            const mondayText = lead.openingHours[0];
                                            if (!mondayText) return <span className="text-gray-900 font-medium">Brak danych</span>;

                                            if (mondayText.toLowerCase().includes('zamknięte') || mondayText.toLowerCase().includes('closed')) {
                                                return <span className="text-red-600 font-bold">Zamknięte</span>;
                                            }

                                            const timePart = mondayText.split(/:\s+/).slice(1).join(': ').trim();
                                            const displayTime = timePart || mondayText;

                                            return <span className="text-green-600 font-medium">{displayTime}</span>;
                                        })()}
                                    </div>

                                    {!lead.latitude && !geocodingErrors[lead.id] && <span className="text-[10px] text-orange-500 block mt-1">Brak współrzędnych (Geocodowanie...)</span>}
                                    {geocodingErrors[lead.id] && <span className="text-[10px] text-red-500 block mt-1">Nie znaleziono adresu</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative bg-gray-100">
                <Map
                    defaultCenter={currentLeads.find(l => l.latitude)?.latitude ? { lat: currentLeads.find(l => l.latitude)!.latitude!, lng: currentLeads.find(l => l.latitude)!.longitude! } : defaultCenter}
                    defaultZoom={currentLeads.length > 0 ? 10 : 6}
                    mapId="DEMO_MAP_ID"
                    gestureHandling={'greedy'}
                    disableDefaultUI={false}
                >
                    {currentLeads.map((lead, idx) => (
                        lead.latitude && lead.longitude && (
                            <AdvancedMarker
                                key={lead.id}
                                position={{ lat: lead.latitude, lng: lead.longitude }}
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white border-2 border-white shadow-lg flex items-center justify-center font-bold text-sm transform transition-transform hover:scale-110">
                                    {idx + 1}
                                </div>
                            </AdvancedMarker>
                        )
                    ))}
                </Map>

                {/* Floating Info */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-xs font-semibold text-gray-600">
                    Tryb Mapy
                </div>

                {/* Optimization Success Toast */}
                {optimizationSuccess && (
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse">
                        <Sparkles size={16} className="text-purple-400" />
                        Trasa została ułożona z AI
                    </div>
                )}
            </div>
        </div>
    );
};

// Wrapper Component that provides the API Context
export const MapView: React.FC<MapViewProps> = (props) => {
    return (
        <APIProvider apiKey={API_KEY}>
            <MapContent {...props} />
        </APIProvider>
    );
};
