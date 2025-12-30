'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CloudRain, Sun, Moon, Cloud, CloudLightning, Snowflake, Wind, Sparkles, Sunrise, Sunset } from 'lucide-react';
import RDNTicker from './RDNTicker';
import FuturesTicker from './FuturesTicker';

export default function DashboardWidgets() {
    const [weather, setWeather] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [quote, setQuote] = useState('');
    const [locationName, setLocationName] = useState('');

    const MOTIVATIONAL_QUOTES = [
        "Dzisiaj jest idealny dzień, aby pobić swoje rekordy!",
        "Każde 'nie' przybliża Cię do 'tak'.",
        "Twój sukces zależy od Twojej determinacji.",
        "Sprzedaż to nie magia, to systematyczność i empatia.",
        "Bądź o 1% lepszy niż wczoraj, a sukces przyjdzie sam.",
        "Klienci kupują od tych, którym ufają. Buduj zaufanie.",
        "Twoja energia jest zaraźliwa – zarażaj entuzjazmem!",
        "Najlepszy czas na działanie jest teraz."
    ];

    useEffect(() => {
        // Function to fetch weather for a given point
        const fetchWeatherForLocation = async (lat: number, lng: number, nameFallback: string) => {
            try {
                // Fetch Weather
                const weatherPromise = fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&daily=sunrise,sunset&timezone=auto`
                ).then(res => res.json());

                // Reverse Geocode (Google Maps) only if exact location
                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                const geocodePromise = (apiKey && nameFallback === "Twoja lokalizacja")
                    ? fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
                        .then(res => res.json())
                    : Promise.resolve(null);

                const [weatherData, geocodeData] = await Promise.all([weatherPromise, geocodePromise]);

                setWeather({
                    temp: weatherData.current.temperature_2m,
                    code: weatherData.current.weather_code,
                    sunrise: weatherData.daily.sunrise[0],
                    sunset: weatherData.daily.sunset[0]
                });

                if (geocodeData && geocodeData.results && geocodeData.results[0]) {
                    // Try to find locality or administrative_area_level_1
                    const addressComponents = geocodeData.results[0].address_components;
                    const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name
                        || addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name
                        || nameFallback;
                    setLocationName(city);
                } else {
                    setLocationName(nameFallback);
                }
            } catch (err) {
                console.error('Data fetch error:', err);
                setError('Nie udało się pobrać danych');
            } finally {
                setLoading(false);
            }
        };

        // 1. Try Geolocation
        if (!navigator.geolocation) {
            // Fallback to Warsaw
            fetchWeatherForLocation(52.2297, 21.0122, "Warszawa (Domyślna)");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherForLocation(latitude, longitude, "Twoja lokalizacja");
            },
            () => {
                // Fallback to Warsaw on error/deny
                // Fallback to Warsaw on error/deny
                fetchWeatherForLocation(52.2297, 21.0122, "Warszawa (Domyślna)");
            }
        );

        // 4. Set Random Quote
        const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        setQuote(randomQuote);

    }, []);

    const formatTime = (isoString: string) => {
        if (!isoString) return '';
        return isoString.split('T')[1];
    };

    const getWeatherContent = (code: number) => {
        // WMO Weather interpretation
        // 0-3: Clear/Cloudy
        // 45, 48: Fog
        // 51-67: Drizzle/Rain
        // 71-77: Snow
        // 80-82: Showers
        // 95-99: Thunderstorm

        const now = new Date();
        const currentTime = now.toISOString().split('T')[1].slice(0, 5); // HH:mm
        const isNight = weather?.sunrise && weather?.sunset && (currentTime < formatTime(weather.sunrise) || currentTime > formatTime(weather.sunset));

        if (code >= 51 && code <= 67 || code >= 80 && code <= 82) { // Rain
            return {
                icon: <CloudRain className="w-8 h-8" />,
                text: "Opady deszczu. Weź parasol!",
            };
        }

        if (code <= 3) { // Sun/Clear
            return {
                icon: isNight
                    ? <Moon className="w-8 h-8" />
                    : <img src="/sun-icon.jpg" alt="Słonecznie" className="w-8 h-8 object-contain" />,
                text: isNight
                    ? "Spokojna noc. Odpocznij przed jutrem."
                    : "Słonecznie i pogodnie. Miłego dnia!",
            };
        }

        if (code >= 71 && code <= 77) { // Snow
            return {
                icon: <Snowflake className="w-8 h-8" />,
                text: "Opady śniegu. Uwaga na drogach!",
            };
        }

        if (code >= 95) { // Thunderstorm
            return {
                icon: <CloudLightning className="w-8 h-8" />,
                text: "Możliwe burze. Zachowaj ostrożność.",
            };
        }

        // Default
        return {
            icon: <Cloud className="w-8 h-8" />,
            text: "Pochmurno, ale stabilnie.",
        };
    };

    if (loading) return <div className="animate-pulse h-24 bg-gray-100 rounded-xl mb-8"></div>;

    // Fallback if no weather data (e.g. error)
    // removed early return to allow energy tickers to show

    const weatherInfo = weather ? getWeatherContent(weather.code) : null;

    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <RDNTicker />
                <FuturesTicker />
            </div>

        </div>
    );
}
