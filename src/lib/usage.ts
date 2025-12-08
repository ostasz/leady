import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type ServiceType = 'google_maps' | 'openai' | 'gemini' | 'gus';

export interface UsageLog {
    userId: string;
    timestamp: FieldValue;
    service: ServiceType;
    action: string;
    quantity: number;
    estimatedCostMicros: number; // USD micros (1 USD = 1,000,000 micros)
    details?: any;
}

// Pricing Table (Approximate USD micros)
const PRICE_TABLE: Record<string, number> = {
    // Google Maps
    'google_maps:text_search': 35000, // $35.00 / 1000 = $0.035
    'google_maps:place_details': 17000, // $17.00 / 1000 = $0.017
    'google_maps:nearby_search': 32000, // $32.00 / 1000 = $0.032
    'google_maps:geocoding': 5000,    // $5.00 / 1000 = $0.005
    'google_maps:directions': 5000,   // $5.00 / 1000 = $0.005 (Basic)

    // Gemini (Flash) - Per 1k tokens approx
    // Input: $0.075 / 1M = $0.000075 / 1k tokens = 0.075 micros / token
    // Output: $0.30 / 1M = $0.0003 / 1k tokens = 0.3 micros / token
    // Let's use simplified per-call cost for now if token counts aren't easy, 
    // or per-token if we pass quantity as tokens.
    // Assuming 'quantity' for Gemini is "1 call" for now to simplify, or we can be precise.
    // Let's assume average call is ~1000 input + ~500 output tokens.
    // Cost ~= 75 micros + 150 micros = 225 micros.
    'gemini:generate_content': 250,

    // GUS (Free)
    'gus:search': 0,
};

export function calculateEstimatedCost(service: ServiceType, action: string, quantity: number = 1): number {
    const key = `${service}:${action}`;
    const unitCost = PRICE_TABLE[key] || 0;
    return unitCost * quantity;
}

export async function logUsage(
    userId: string,
    service: ServiceType,
    action: string,
    quantity: number = 1,
    details: any = {}
) {
    try {
        const estimatedCostMicros = calculateEstimatedCost(service, action, quantity);

        const logEntry: UsageLog = {
            userId,
            timestamp: FieldValue.serverTimestamp(),
            service,
            action,
            quantity,
            estimatedCostMicros,
            details
        };

        await adminDb.collection('usage_logs').add(logEntry);

        // Optional: Update aggregated stats on user document (atomic increment)
        // This helps with quick dashboard views without querying all logs
        await adminDb.collection('users').doc(userId).set({
            usageStats: {
                [`${service}_cost`]: FieldValue.increment(estimatedCostMicros),
                totalCost: FieldValue.increment(estimatedCostMicros),
                queryCount: FieldValue.increment(1)
            }
        }, { merge: true });

    } catch (error) {
        console.error('Failed to log usage:', error);
    }
}
