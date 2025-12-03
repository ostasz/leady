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
 * Get price color based on value
 */
export function getPriceColor(price: number): string {
    if (price < 250) return '#10b981'; // Green
    if (price < 300) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
    return `${price.toFixed(2)} PLN/MWh`;
}
