import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const adminUserDoc = await adminDb.collection('users').doc(uid).get();
        if (adminUserDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const fromDateStr = searchParams.get('from');
        const toDateStr = searchParams.get('to');

        let userCostsMap: Record<string, { queryCount: number, totalCost: number, chatCost: number, searchCost: number }> = {};

        // 1. If Date Range Provided -> Calculate from Logs
        if (fromDateStr && toDateStr) {
            const start = new Date(fromDateStr);
            const end = new Date(toDateStr);
            end.setHours(23, 59, 59, 999); // Include the whole end day

            const logsSnapshot = await adminDb.collection('usage_logs')
                .where('timestamp', '>=', start)
                .where('timestamp', '<=', end)
                .get();

            logsSnapshot.docs.forEach(doc => {
                const log = doc.data();
                const uid = log.userId;
                const cost = log.estimatedCostMicros || 0;
                const service = log.service;
                const action = log.action;

                if (!userCostsMap[uid]) {
                    userCostsMap[uid] = { queryCount: 0, totalCost: 0, chatCost: 0, searchCost: 0 };
                }

                userCostsMap[uid].queryCount += 1;
                userCostsMap[uid].totalCost += cost;

                const isChat = service === 'gemini' && action === 'admin_chat' || service === 'assistant:query';
                const isSearch = service === 'google_maps' || service === 'gus' || (service === 'gemini' && action === 'generate_content');

                if (isChat) userCostsMap[uid].chatCost += cost;
                else if (isSearch) userCostsMap[uid].searchCost += cost;
            });
        }
        // 2. If No Date Range -> Use User Stats (All Time)
        else {
            // Recalculate from all logs to ensure chat/search split is correct
            // since historical usageStats might be missing these fields.
            const allLogsSnapshot = await adminDb.collection('usage_logs').get();

            allLogsSnapshot.docs.forEach(doc => {
                const log = doc.data();
                const uid = log.userId;
                const cost = log.estimatedCostMicros || 0;
                const service = log.service;
                const action = log.action;

                if (!userCostsMap[uid]) {
                    userCostsMap[uid] = { queryCount: 0, totalCost: 0, chatCost: 0, searchCost: 0 };
                }

                userCostsMap[uid].queryCount += 1;
                userCostsMap[uid].totalCost += cost;

                const isChat = service === 'gemini' && action === 'admin_chat' || service === 'assistant:query';
                const isSearch = service === 'google_maps' || service === 'gus' || (service === 'gemini' && action === 'generate_content');

                if (isChat) userCostsMap[uid].chatCost += cost;
                else if (isSearch) userCostsMap[uid].searchCost += cost;
            });
        }

        // 3. Fetch User Details to Merge (Name/Email)
        // Optimization: logic simplified, fetching all users again to map names might be redundant if we did #2, but needed for #1
        // To be safe and consistent: Fetch all users map
        const allUsersSnapshot = await adminDb.collection('users').get();
        const usersDetails = new Map(allUsersSnapshot.docs.map(d => [d.id, d.data()]));

        const costs = Array.from(usersDetails.entries())
            .map(([uid, data]) => {
                const stats = userCostsMap[uid] || { queryCount: 0, totalCost: 0, chatCost: 0, searchCost: 0 };

                return {
                    id: uid,
                    name: data.displayName || data.name || 'Nieznany',
                    email: data.email || 'brak@email',
                    queryCount: stats.queryCount,
                    totalCost: stats.totalCost / 1000000,
                    chatCost: stats.chatCost / 1000000,
                    searchCost: stats.searchCost / 1000000
                };
            })
            // Filter out empty rows if range selected (or all time)
            .filter(u => u.totalCost > 0 || u.queryCount > 0)
            .sort((a, b) => b.totalCost - a.totalCost);

        const totalSystemCost = costs.reduce((acc, curr) => acc + curr.totalCost, 0);

        return NextResponse.json({
            users: costs,
            totalSystemCost
        });


    } catch (error: any) {
        console.error('[AdminCosts] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
