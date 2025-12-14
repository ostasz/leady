import React, { useState, useEffect } from 'react';
import { Lead } from './types';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin, Sparkles, Navigation, Locate, Map as MapIcon, List, ChevronUp, ChevronDown, Edit2 } from 'lucide-react';
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
    const [showMobileMap, setShowMobileMap] = useState(false);
    const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);

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
    const geometryLib = useMapsLibrary('geometry');
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
        if (!geometryLib || !startLocation || optimizedLeads.length === 0) return;
        setIsLoading(true);

        try {
            const geocoder = new google.maps.Geocoder();
            let startCoords: google.maps.LatLng | null = null;

            // 1. Geocode Start Location
            try {
                const res = await geocoder.geocode({ address: startLocation });
                if (res.results[0]) {
                    startCoords = res.results[0].geometry.location;
                }
            } catch (e) {
                console.warn('Geocoding start location failed', e);
            }

            // Fallback: If start geocoding fails, try to use first lead or default
            if (!startCoords) {
                console.warn('Could not geocode start, using Warsaw center as fallback fallback');
                startCoords = new google.maps.LatLng(52.2297, 21.0122);
            }

            // 2. Sort using Nearest Neighbor
            const leadsToProcess = [...optimizedLeads];
            const sortedLeads: Lead[] = [];
            let currentPos = startCoords;

            while (leadsToProcess.length > 0) {
                let nearestIdx = -1;
                let minDist = Infinity;

                // Find nearest unvisited lead
                leadsToProcess.forEach((lead, idx) => {
                    if (lead.latitude && lead.longitude) {
                        const leadPos = new google.maps.LatLng(lead.latitude, lead.longitude);
                        const dist = google.maps.geometry.spherical.computeDistanceBetween(currentPos, leadPos);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestIdx = idx;
                        }
                    } else {
                        // If no coords, treat as infinite distance (push to end)
                    }
                });

                if (nearestIdx !== -1) {
                    const nearest = leadsToProcess[nearestIdx];
                    sortedLeads.push(nearest);
                    currentPos = new google.maps.LatLng(nearest.latitude!, nearest.longitude!);
                    leadsToProcess.splice(nearestIdx, 1);
                } else {
                    // Remaining leads have no coordinates
                    sortedLeads.push(...leadsToProcess);
                    break;
                }
            }

            setOptimizedLeads(sortedLeads);

            // Save the new order
            setDailyRouteOrder(prev => ({
                ...prev,
                [selectedDateKey]: sortedLeads.map(l => l.id)
            }));

            setOptimizationSuccess(true);
            setTimeout(() => setOptimizationSuccess(false), 3000);

        } catch (e) {
            console.error('Optimization failed', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseCurrentLocation = (setter: (val: string) => void) => {
        if (!navigator.geolocation) {
            alert('Geolokalizacja nie jest wspierana przez Twoją przeglądarkę.');
            return;
        }

        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const geocoder = new google.maps.Geocoder();
                const res = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
                if (res.results[0]) {
                    setter(res.results[0].formatted_address);
                }
            } catch (e) {
                console.error('Reverse geocoding failed', e);
            } finally {
                setIsLoading(false);
            }
        }, (err) => {
            console.error('Geolocation error', err);
            setIsLoading(false);
        });
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
        <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden relative">
            {/* Left Sidebar: Itinerary - Full width on mobile when map hidden */}
            <div className={`
                flex flex-col bg-white border-r border-gray-200 transition-all duration-300
                ${showMobileMap ? 'hidden md:flex' : 'w-full md:w-1/3 md:min-w-[350px]'}
            `}>
                {/* Day Selector - Compact */}
                <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-hide py-1">
                    {days.map(date => {
                        const dateKey = format(date, 'yyyy-MM-dd');
                        const isSelected = dateKey === selectedDateKey;
                        const count = (scheduledLeads[dateKey] || []).length;
                        return (
                            <button
                                key={dateKey}
                                onClick={() => setSelectedDateKey(dateKey)}
                                className={`
                                    flex-1 py-2 text-center min-w-[60px] border-b-2 transition-colors
                                    ${isSelected ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:bg-gray-50'}
                                `}
                            >
                                <div className="text-[10px] font-medium text-gray-400 uppercase leading-none mb-1">{format(date, 'EEE', { locale: pl })}</div>
                                <div className={`text-sm font-bold leading-none ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {format(date, 'd.MM')}
                                </div>
                                {count > 0 && isSelected && (
                                    <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-1" />
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className="border-b border-gray-100 bg-white z-10 shadow-sm">
                    {/* Collapsed Header */}
                    {isSettingsCollapsed ? (
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setIsSettingsCollapsed(false)}
                        >
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Trasa</span>
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <span className="truncate max-w-[120px]">{startLocation.split(',')[0]}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="truncate max-w-[120px]">{endLocation.split(',')[0]}</span>
                                </div>
                            </div>
                            <button className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100">
                                <Edit2 size={16} />
                            </button>
                        </div>
                    ) : (
                        /* Expanded Controls */
                        <div className="p-4 space-y-4 relative">
                            <button
                                onClick={() => setIsSettingsCollapsed(true)}
                                className="absolute top-2 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <ChevronUp size={20} />
                            </button>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Początek trasy</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={startLocation}
                                            onChange={(e) => handleStartChange(e.target.value)}
                                            className="w-full text-sm font-medium text-gray-900 border border-gray-300 rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                            placeholder="Wpisz adres lub użyj lokalizacji..."
                                        />
                                        <button
                                            onClick={() => handleUseCurrentLocation(setStartLocation)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors p-1"
                                            title="Użyj mojej lokalizacji"
                                        >
                                            <Locate size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Koniec trasy</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={endLocation}
                                            onChange={(e) => handleEndChange(e.target.value)}
                                            className="w-full text-sm font-medium text-gray-900 border border-gray-300 rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                            placeholder="Wpisz adres lub użyj lokalizacji..."
                                        />
                                        <button
                                            onClick={() => handleUseCurrentLocation(setEndLocation)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors p-1"
                                            title="Użyj mojej lokalizacji"
                                        >
                                            <Locate size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleOptimize}
                                    className="flex-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={18} />
                                    Ułóż z AI
                                </button>

                                <button
                                    onClick={handleExportToGoogleMaps}
                                    className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl shadow-sm hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center"
                                    title="Eksportuj do Google Maps"
                                >
                                    <Navigation size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Itinerary List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                    {currentLeads.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">
                            <p>Brak zaplanowanych spotkań na ten dzień.</p>
                            <p className="text-sm mt-2">Przeciągnij leady w widoku kalendarza.</p>
                        </div>
                    ) : (
                        currentLeads.map((lead, idx) => (
                            <div key={lead.id} className="group bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all flex gap-3 items-start">
                                <div className="flex flex-col items-center pt-1">
                                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md ring-2 ring-blue-100 group-hover:ring-blue-200 transition-all">
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 text-[15px] leading-tight truncate">{lead.companyName}</span>
                                        <span className="text-xs text-gray-500 mt-1 truncate">{lead.address}</span>
                                    </div>

                                    {/* Opening Hours */}
                                    <div className="text-[11px] mt-2 flex items-center gap-2">
                                        {(() => {
                                            if (!lead.openingHours || lead.openingHours.length === 0) {
                                                return <span className="text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">Brak godzin</span>;
                                            }

                                            const mondayText = lead.openingHours[0];
                                            if (!mondayText) return <span className="text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">Brak godzin</span>;

                                            if (mondayText.toLowerCase().includes('zamknięte') || mondayText.toLowerCase().includes('closed')) {
                                                return <span className="text-red-700 bg-red-50 font-bold px-2 py-0.5 rounded-full">Zamknięte</span>;
                                            }

                                            const timePart = mondayText.split(/:\s+/).slice(1).join(': ').trim();
                                            const displayTime = timePart || mondayText;

                                            return <span className="text-green-700 bg-green-50 font-bold px-2 py-0.5 rounded-full">{displayTime}</span>;
                                        })()}

                                        {geocodingErrors[lead.id] && <span className="text-red-500 font-bold">! Adres</span>}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Map Area - Hidden on mobile if NOT active */}
            <div className={`
                relative bg-gray-100 transition-all duration-300
                ${showMobileMap ? 'w-full h-full block fixed inset-0 z-50 md:static md:block md:w-auto' : 'hidden md:block md:flex-1'}
            `}>
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
                <div className="absolute top-20 left-4 md:top-4 md:left-auto md:right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-xs font-semibold text-gray-600 z-10">
                    Tryb Mapy
                </div>

                {/* Mobile Back Button (Only on mobile map view) */}
                <button
                    onClick={() => setShowMobileMap(false)}
                    className="md:hidden absolute top-4 right-4 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-primary transition-colors z-50"
                >
                    <List size={24} />
                </button>

                {/* Optimization Success Toast */}
                {optimizationSuccess && (
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse z-20">
                        <Sparkles size={16} className="text-purple-400" />
                        Trasa została ułożona z AI
                    </div>
                )}
            </div>

            {/* FAB: Floating Action Button for Mobile Map Toggle */}
            {!showMobileMap && (
                <button
                    onClick={() => setShowMobileMap(true)}
                    className="md:hidden absolute bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition-all hover:scale-110 z-50 flex items-center justify-center"
                >
                    <MapIcon size={28} />
                </button>
            )}
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
