import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type ServiceType = 'google_maps' | 'openai' | 'gemini' | 'gus' | 'assistant:query' | 'vertex-gemini';

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
    'google_maps:text_search': 32000, // $32.00 / 1000 = $0.032 (Text Search ID Only)
    'google_maps:place_details': 17000, // $17.00 / 1000 = $0.017 (Contact Data)
    'google_maps:nearby_search': 32000, // $32.00 / 1000 = $0.032
    'google_maps:geocoding': 5000,    // $5.00 / 1000 = $0.005
    'google_maps:directions': 5000,   // $5.00 / 1000 = $0.005 (Basic)

    // Assuming 'quantity' for Gemini is "1 call" for now to simplify, or we can be precise.
    // Let's assume average call is ~1000 input + ~500 output tokens.
    // Cost ~= 75 micros + 150 micros = 225 micros.
    'gemini:generate_content': 250,
    'vertex-gemini:generate_content': 250,

    // GUS (Free)
    'gus:search': 0,

    // AI Assistant
    'assistant:query': 1000,
    'gemini:admin_chat': 500, // ~$0.0005 per message
    'vertex-gemini:admin_chat': 500,
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
        // Determine category for cost tracking
        const isChat = (service === 'gemini' || service === 'vertex-gemini') && action === 'admin_chat' || service === 'assistant:query';
        const isSearch = service === 'google_maps' || service === 'gus' || ((service === 'gemini' || service === 'vertex-gemini') && action === 'generate_content');

        const updateData: any = {
            [`${service}_cost`]: FieldValue.increment(estimatedCostMicros),
            totalCost: FieldValue.increment(estimatedCostMicros),
            queryCount: FieldValue.increment(1)
        };

        if (isChat) {
            updateData.chat_cost = FieldValue.increment(estimatedCostMicros);
        } else if (isSearch) {
            updateData.search_cost = FieldValue.increment(estimatedCostMicros);
        }

        await adminDb.collection('users').doc(userId).set({
            usageStats: updateData
        }, { merge: true });

    } catch (error) {
        console.error('Failed to log usage:', error);
    }
}

export async function getMonthlyUsage(userId: string, service: ServiceType): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
        // Count documents in usage_logs for this user/service this month
        // Using collection() instead of collectionGroup() to avoid complex index requirements
        // since we only write to the root usage_logs collection.
        const snapshot = await adminDb.collection('usage_logs')
            .where('userId', '==', userId)
            .where('service', '==', service)
            .where('timestamp', '>=', startOfMonth)
            .count()
            .get();

        return snapshot.data().count;
    } catch (error) {
        console.error('Error fetching monthly usage (possibly missing index):', error);
        // Fail open: return 0 usage so simple queries work even if stats are broken
        return 0;
    }
}

export async function hasRemainingQuota(userId: string, maxLimit: number = 100): Promise<boolean> {
    const usageCount = await getMonthlyUsage(userId, 'assistant:query');
    return usageCount < maxLimit;
}
