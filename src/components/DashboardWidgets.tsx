'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CloudRain, Sun, Cloud, CloudLightning, Snowflake, Wind, Sparkles, Sunrise, Sunset } from 'lucide-react';

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
        // 1. Get Location
        if (!navigator.geolocation) {
            setError('Brak wsparcia geolokalizacji');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;

                    // 2. Fetch Weather
                    const weatherPromise = fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code&daily=sunrise,sunset&timezone=auto`
                    ).then(res => res.json());

                    // 3. Reverse Geocode (Google Maps)
                    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                    const geocodePromise = apiKey
                        ? fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`)
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
                            || "Twoja lokalizacja";
                        setLocationName(city);
                    } else {
                        setLocationName(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
                    }

                } catch (err) {
                    console.error('Data fetch error:', err);
                    setError('Nie udało się pobrać danych');
                } finally {
                    setLoading(false);
                }
            },
            () => {
                setError('Brak dostępu do lokalizacji');
                setLoading(false);
            }
        );

        // 4. Set Random Quote
        const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        setQuote(randomQuote);

    }, []);

    const getWeatherContent = (code: number) => {
        // WMO Weather interpretation
        // 0-3: Clear/Cloudy
        // 45, 48: Fog
        // 51-67: Drizzle/Rain
        // 71-77: Snow
        // 80-82: Showers
        // 95-99: Thunderstorm

        if (code >= 51 && code <= 67 || code >= 80 && code <= 82) { // Rain
            return {
                icon: <CloudRain className="w-8 h-8 text-blue-500" />,
                text: "Opady deszczu. Weź parasol!",
                color: "bg-blue-50 border-blue-100"
            };
        }

        if (code <= 3) { // Sun/Clear
            return {
                icon: <Sun className="w-8 h-8 text-yellow-500" />,
                text: "Słonecznie i pogodnie. Miłego dnia!",
                color: "bg-yellow-50 border-yellow-100"
            };
        }

        if (code >= 71 && code <= 77) { // Snow
            return {
                icon: <Snowflake className="w-8 h-8 text-cyan-500" />,
                text: "Opady śniegu. Uwaga na drogach!",
                color: "bg-cyan-50 border-cyan-100"
            };
        }

        if (code >= 95) { // Thunderstorm
            return {
                icon: <CloudLightning className="w-8 h-8 text-purple-500" />,
                text: "Możliwe burze. Zachowaj ostrożność.",
                color: "bg-purple-50 border-purple-100"
            };
        }

        // Default
        return {
            icon: <Cloud className="w-8 h-8 text-gray-500" />,
            text: "Pochmurno, ale stabilnie.",
            color: "bg-gray-50 border-gray-100"
        };
    };

    if (loading) return <div className="animate-pulse h-24 bg-gray-100 rounded-xl mb-8"></div>;

    // Fallback if no weather data (e.g. error)
    if (error || !weather) return (
        <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex items-center gap-4">
                <Sparkles className="w-8 h-8 text-primary" />
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Do dzieła!</h2>
                    <p className="text-gray-600 italic">"{quote}"</p>
                </div>
            </div>
        </div>
    );

    const weatherInfo = getWeatherContent(weather.code);
    const formatTime = (isoString: string) => {
        if (!isoString) return '';
        return isoString.split('T')[1];
    };

    return (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weather Widget */}
            <Link href="/apps/weather" className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 ${weatherInfo.color} transition-all hover:shadow-md cursor-pointer`}>
                <div className="bg-white p-3 rounded-full shadow-sm">
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
    );
}
