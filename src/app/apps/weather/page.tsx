'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Calendar, Wind, Droplets, Sun, Moon, CloudRain, Cloud, CloudLightning, Snowflake, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WeatherApp() {
    const { user, userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [weatherData, setWeatherData] = useState<any>(null);
    const [forecastData, setForecastData] = useState<any>(null);
    const [hourlyData, setHourlyData] = useState<any[]>([]);
    const [locationName, setLocationName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
            } else {
                // Initial load - user's location
                getUserLocation();
            }
        }
    }, [user, userData, authLoading, router]);

    const getUserLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    fetchWeather(position.coords.latitude, position.coords.longitude);
                    reverseGeocode(position.coords.latitude, position.coords.longitude);
                },
                () => {
                    // Fallback to Warsaw if location denied
                    fetchWeather(52.2297, 21.0122);
                    setLocationName('Warszawa');
                }
            );
        } else {
            fetchWeather(52.2297, 21.0122);
            setLocationName('Warszawa');
        }
    };

    const fetchWeather = async (lat: number, lng: number) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&hourly=temperature_2m,weather_code&timezone=auto`
            );
            const data = await response.json();
            setWeatherData(data.current);
            setForecastData(data.daily);

            // Process hourly data
            const allHourlyData = data.hourly.time.map((time: string, index: number) => {
                const datePart = time.slice(0, 10);
                // Find the index in daily data that matches this date
                const dayIndex = data.daily.time.findIndex((d: string) => d === datePart);

                let isNight = false;
                if (dayIndex !== -1) {
                    const sunrise = data.daily.sunrise[dayIndex];
                    const sunset = data.daily.sunset[dayIndex];
                    isNight = time < sunrise || time > sunset;
                }

                return {
                    time: time,
                    temp: data.hourly.temperature_2m[index],
                    code: data.hourly.weather_code[index],
                    isNight: isNight
                };
            });

            // Find index of current hour (approximate match by matching date and hour string)
            const now = new Date();
            const currentHourStr = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH

            let startIndex = allHourlyData.findIndex((item: any) => item.time.startsWith(currentHourStr));
            if (startIndex === -1) {
                // Fallback: try to find first item after now if exact hour match fails
                startIndex = 0;
            }

            // Take next 24 hours
            const next24Hours = allHourlyData.slice(startIndex, startIndex + 24);

            setHourlyData(next24Hours);

        } catch (err) {
            console.error(err);
            setError('Błąd pobierania danych pogodowych.');
        } finally {
            setLoading(false);
        }
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return;

        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
            const data = await response.json();
            if (data.results?.[0]) {
                const addressComponents = data.results[0].address_components;
                const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name
                    || addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name
                    || "Twoja lokalizacja";
                setLocationName(city);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            setError('Brak klucza API Google Maps do wyszukiwania miast.');
            return;
        }

        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`);
            const data = await response.json();

            if (data.results?.[0]) {
                const { lat, lng } = data.results[0].geometry.location;
                setLocationName(data.results[0].formatted_address.split(',')[0]); // Simple city name extraction
                fetchWeather(lat, lng);
            } else {
                setError('Nie znaleziono takiej lokalizacji.');
            }
        } catch (err) {
            setError('Błąd wyszukiwania lokalizacji.');
        }
    };

    const getWeatherIcon = (code: number, size = 24, isNight = false) => {
        // Simple mapping
        if (code <= 3) {
            return isNight
                ? <Moon size={size} className="text-indigo-300" />
                : <Sun size={size} className="text-yellow-500" />;
        }
        if (code >= 51 && code <= 67) return <CloudRain size={size} className="text-blue-500" />;
        if (code >= 71 && code <= 77) return <Snowflake size={size} className="text-cyan-500" />;
        if (code >= 95) return <CloudLightning size={size} className="text-purple-500" />;
        return <Cloud size={size} className="text-gray-500" />;
    };

    if (authLoading || (loading && !weatherData)) {
        return <div className="min-h-screen flex items-center justify-center">Ładowanie pogody...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
                        <ArrowLeft size={20} />
                        Wróć do Panelu
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Prognoza Pogody</h1>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="mb-8 flex gap-2">
                    <div className="relative flex-1">
                        <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Wpisz nazwę miasta..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                        />
                    </div>
                    <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl hover:bg-primary-dark transition-colors font-semibold flex items-center gap-2">
                        <Search size={20} />
                        Szukaj
                    </button>
                </form>

                {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-xl">{error}</div>}

                {weatherData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Current Weather Card */}
                        <div className="col-span-1 md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row items-center justify-between bg-gradient-to-br from-blue-50 to-white">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-white rounded-full shadow-md">
                                    {getWeatherIcon(weatherData.weather_code, 64)}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-900">{locationName}</h2>
                                    <div className="flex items-end gap-2 text-gray-600">
                                        <span className="text-6xl font-bold text-gray-900">{weatherData.temperature_2m}°</span>
                                        <span className="text-xl mb-2">Teraz</span>
                                    </div>
                                    <div className="mt-2 text-gray-500 font-medium flex gap-4">
                                        <span className="flex items-center gap-1"><Droplets size={16} /> Win: {weatherData.relative_humidity_2m}%</span>
                                        <span className="flex items-center gap-1"><Wind size={16} /> Wiatr: {weatherData.wind_speed_10m} km/h</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 md:mt-0 text-right">
                                <p className="text-gray-500 text-sm">Odczuwalna</p>
                                <p className="text-2xl font-semibold text-gray-800">{weatherData.apparent_temperature}°</p>
                            </div>
                        </div>

                        {/* Hourly Forecast */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Wind size={20} />
                                Nadchodzące 24h
                            </h3>
                            <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {hourlyData.length > 0 ? (
                                    hourlyData.map((item: any) => (
                                        <div key={item.time} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                            <span className="font-semibold text-gray-700 text-sm">
                                                {item.time.slice(11, 16)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {getWeatherIcon(item.code, 18, item.isNight)}
                                                <span className="font-bold text-gray-900 w-10 text-right text-sm">{item.temp}°</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-4 text-sm">Koniec dnia!</p>
                                )}
                            </div>
                        </div>

                        {/* 7 Day Forecast */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar size={20} />
                                Prognoza 7-dniowa
                            </h3>
                            <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {forecastData.time.map((date: string, index: number) => (
                                    <div key={date} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-700 text-sm">
                                                {new Date(date).toLocaleDateString('pl-PL', { weekday: 'long' })}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {getWeatherIcon(forecastData.weather_code[index], 18)}
                                            <div className="flex flex-col items-end w-12">
                                                <span className="font-bold text-gray-900 text-sm">{forecastData.temperature_2m_max[index]}°</span>
                                                <span className="text-[10px] text-gray-500">{forecastData.temperature_2m_min[index]}°</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
