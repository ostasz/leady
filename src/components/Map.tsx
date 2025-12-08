'use client';

import { Map as GoogleMap, AdvancedMarker, Pin, useMap, MapMouseEvent } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';

interface MapProps {
    center: { lat: number; lng: number };
    markers: Array<{
        id: string;
        location: { lat: number; lng: number };
        name: string;
    }>;
    routePath?: Array<{ lat: number; lng: number }>;
    onMapClick?: (e: MapMouseEvent) => void;
    onMarkerClick?: (id: string) => void;
    selectedLocation?: { lat: number; lng: number } | null;
}

export default function Map({ center, markers, routePath, onMapClick, onMarkerClick, selectedLocation }: MapProps) {
    const map = useMap();

    useEffect(() => {
        if (map && routePath && routePath.length > 0) {
            const path = new google.maps.Polyline({
                path: routePath,
                geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2,
            });
            path.setMap(map);

            // Fit bounds
            const bounds = new google.maps.LatLngBounds();
            routePath.forEach(p => bounds.extend(p));
            map.fitBounds(bounds);

            return () => {
                path.setMap(null);
            };
        } else if (map && center) {
            map.panTo(center);
            map.setZoom(10);
        }
    }, [map, routePath, center]);

    return (
        <GoogleMap
            defaultCenter={center}
            defaultZoom={10}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
            className="w-full h-full"
            onClick={onMapClick}
            mapId={'DEMO_MAP_ID'} // Required for AdvancedMarker
        >
            {markers.map(marker => (
                <AdvancedMarker
                    key={marker.id}
                    position={marker.location}
                    title={marker.name}
                    clickable={true}
                    onClick={() => onMarkerClick && onMarkerClick(marker.id)}
                />
            ))}
            {selectedLocation && (
                <AdvancedMarker
                    position={selectedLocation}
                    title="Wybrany punkt"
                >
                    <Pin background={'#22ccff'} borderColor={'#1e88e5'} glyphColor={'#0044ff'} />
                </AdvancedMarker>
            )}
        </GoogleMap>
    );
}
