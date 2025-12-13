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
                console.log("Geolocation denied or failed, falling back to Warsaw");
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
                    : <Sun className="w-8 h-8" />,
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weather Widget */}
                {weather && weatherInfo ? (
                    <Link href="/apps/weather" className="group p-6 rounded-xl shadow-sm border border-gray-100 hover:border-primary/20 bg-white flex items-center gap-4 transition-all hover:shadow-md cursor-pointer">
                        <div className="bg-gray-100 p-3 rounded-lg shadow-sm text-gray-600 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300">
                            {weatherInfo.icon}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-gray-900">{weather.temp}°C</span>
                                    <div className="hidden sm:flex items-center gap-1">
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/50 border border-gray-200 text-gray-600">Teraz</span>
                                        {locationName && <span className="text-xs font-bold text-gray-500">{locationName}</span>}
                                    </div>
                                </div>
                                {/* Sunrise/Sunset */}
                                <div className="flex gap-3 text-xs text-gray-500 font-medium">
                                    <div className="flex items-center gap-1" title="Wschód słońca">
                                        <Sunrise size={14} className="text-orange-400" />
                                        {formatTime(weather.sunrise)}
                                    </div>
                                    <div className="flex items-center gap-1" title="Zachód słońca">
                                        <Sunset size={14} className="text-indigo-400" />
                                        {formatTime(weather.sunset)}
                                    </div>
                                </div>
                            </div>
                            <div className="sm:hidden mb-2">
                                {locationName && <span className="text-xs font-bold text-gray-500">{locationName}</span>}
                            </div>
                            <p className="text-gray-700 font-medium leading-tight text-sm sm:text-base">
                                {weatherInfo.text}
                            </p>
                        </div>
                    </Link>
                ) : (
                    <div className="p-6 rounded-xl shadow-sm border border-gray-100 bg-gray-50 flex items-center justify-center text-center relative overflow-hidden h-full">
                        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center opacity-50">
                            <Cloud className="w-32 h-32 text-gray-200" />
                        </div>
                        <div className="relative z-10">
                            <Cloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm font-medium">Pogoda niedostępna</p>
                            <p className="text-xs text-gray-400 mt-1">{error || 'Brak uprawnień lokalizacji'}</p>
                        </div>
                    </div>
                )}

                {/* Motivation Widget */}
                <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm text-white flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>

                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <Sparkles className="w-8 h-8 text-yellow-300" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="font-bold text-indigo-100 text-xs uppercase tracking-wider mb-1">Motywacja na dziś</h3>
                        <p className="text-lg font-bold leading-tight">
                            "{quote}"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
