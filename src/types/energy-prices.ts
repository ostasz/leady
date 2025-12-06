import { Timestamp } from 'firebase/firestore';

/**
 * Single energy price entry for a specific hour
 */
export interface EnergyPriceEntry {
    id?: string;            // Firestore document ID
    date: string;           // "poniedziałek, 1 styczeń 2024"
    hour: number;           // 1-24
    price: number;          // PLN/MWh
    createdAt: Timestamp;
    createdBy: string;      // admin email
}

/**
 * Aggregated daily price summary with statistics
 */
export interface DailyPriceSummary {
    date: string;
    hourlyPrices: { hour: number; price: number }[];
    statistics: {
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        minHour: number;
        maxHour: number;
        savings: number;      // maxPrice - minPrice
    };
}

/**
 * CSV row format for import
 */
export interface EnergyPriceCSVRow {
    Data: string;           // "poniedziałek, 1 styczeń 2024"
    h_num: string | number; // "1" or 1
    'Average of Cena': string | number; // "236,11" or 236.11
}

/**
 * Helper function to parse Polish number format to float
 */
export function parsePolishNumber(value: string | number): number {
    if (typeof value === 'number') return value;
    return parseFloat(value.replace(',', '.'));
}

/**
 * Helper function to group prices by date
 */
export function groupPricesByDate(entries: EnergyPriceEntry[]): Map<string, EnergyPriceEntry[]> {
    const grouped = new Map<string, EnergyPriceEntry[]>();

    entries.forEach(entry => {
        const existing = grouped.get(entry.date) || [];
        existing.push(entry);
        grouped.set(entry.date, existing);
    });

    return grouped;
}

/**
 * Helper function to calculate daily summary
 */
export function calculateDailySummary(entries: EnergyPriceEntry[]): DailyPriceSummary | null {
    if (entries.length === 0) return null;

    const hourlyPrices = entries
        .map(e => ({ hour: e.hour, price: e.price }))
        .sort((a, b) => a.hour - b.hour);

    const prices = hourlyPrices.map(hp => hp.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    const minEntry = hourlyPrices.find(hp => hp.price === minPrice)!;
    const maxEntry = hourlyPrices.find(hp => hp.price === maxPrice)!;

    return {
        date: entries[0].date,
        hourlyPrices,
        statistics: {
            minPrice,
            maxPrice,
            avgPrice: Math.round(avgPrice * 100) / 100,
            minHour: minEntry.hour,
            maxHour: maxEntry.hour,
            savings: Math.round((maxPrice - minPrice) * 100) / 100
        }
    };
}

/**
 * Get price color based on value relative to daily average
 */
export function getPriceColor(price: number, avgPrice: number): string {
    const ratio = price / avgPrice;

    if (ratio < 0.6) return '#3b82f6'; // Blue
    if (ratio < 0.9) return '#22c55e'; // Green
    if (ratio < 1.1) return '#eab308'; // Yellow
    if (ratio < 1.4) return '#f97316'; // Orange
    return '#ef4444'; // Red
}

export type ShiftType = '1s' | '2s' | '24/7';

export interface ShiftOption {
    id: string;
    label: string;
    type: ShiftType;
    startHour: number; // 1-24
    endHour: number;   // 1-24
}

export const SHIFT_OPTIONS: ShiftOption[] = [
    // 1-shift
    { id: '1s-6-14', label: '6:00 - 14:00', type: '1s', startHour: 6, endHour: 14 },
    { id: '1s-7-15', label: '7:00 - 15:00', type: '1s', startHour: 7, endHour: 15 },
    { id: '1s-8-16', label: '8:00 - 16:00', type: '1s', startHour: 8, endHour: 16 },
    { id: '1s-9-17', label: '9:00 - 17:00', type: '1s', startHour: 9, endHour: 17 },
    // 2-shifts
    { id: '2s-5-21', label: '5:00 - 21:00', type: '2s', startHour: 5, endHour: 21 },
    { id: '2s-6-22', label: '6:00 - 22:00', type: '2s', startHour: 6, endHour: 22 },
    { id: '2s-7-23', label: '7:00 - 23:00', type: '2s', startHour: 7, endHour: 23 },
    // 24/7
    { id: '24/7', label: 'Całą dobę (24h)', type: '24/7', startHour: 1, endHour: 24 },
];

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
    return `${price.toFixed(2)} PLN/MWh`;
}

/**
 * Futures contract entry (BASE Y+1, etc)
 */
export interface FuturesEntry {
    id?: string;
    date: string;           // Quote date (YYYY-MM-DD)
    deliveryYear: number;   // 2026, 2027...
    contractType: 'BASE' | 'PEAK' | 'OFFPEAK';
    price: number;
    createdAt: Timestamp;
    createdBy: string;
}

export interface FuturesCSVRow {
    DataNotowania: string;
    KursRozliczeniowy: string | number;
    'Typ kontraktu': string;
    'Rok dostawy': string | number;
}
