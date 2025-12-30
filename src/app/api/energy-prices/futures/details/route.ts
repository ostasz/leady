import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { format, addMonths, addQuarters, startOfQuarter } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FuturesHistoryPoint } from '@/types/energy-prices';

// Helper to generate contract names dynamically
const getContractNames = () => {
    const now = new Date();
    // const currentYearShort = now.getFullYear().toString().slice(-2);
    const nextYearShort = (now.getFullYear() + 1).toString().slice(-2);
    const nextNextYearShort = (now.getFullYear() + 2).toString().slice(-2);
    const nextNextNextYearShort = (now.getFullYear() + 3).toString().slice(-2);

    // Dynamic Months (Next 3 months)
    const months = [];
    for (let i = 1; i <= 3; i++) {
        const d = addMonths(now, i);
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const y = d.getFullYear().toString().slice(-2);
        const mName = format(d, "MMM''yy", { locale: pl }); // e.g., Sty'26
        months.push({ label: `M-${i} (${mName})`, name: `BASE_M-${m}-${y}` });
    }

    // Dynamic Quarters (Next 4 quarters)
    const quarters = [];
    let qDate = startOfQuarter(addQuarters(now, 1));
    for (let i = 1; i <= 4; i++) {
        const q = Math.ceil((qDate.getMonth() + 1) / 3);
        const y = qDate.getFullYear().toString().slice(-2);
        quarters.push({ label: `Q-${i}'${y}`, name: `BASE_Q-${q}-${y}` });
        qDate = addQuarters(qDate, 1);
    }

    // Years
    const years = [
        { label: `Y-${nextYearShort}`, name: `BASE_Y-${nextYearShort}` },
        { label: `Y-${nextNextYearShort}`, name: `BASE_Y-${nextNextYearShort}` },
        { label: `Y-${nextNextNextYearShort}`, name: `BASE_Y-${nextNextNextYearShort}` }
    ];

    return { months, quarters, years };
};

// Helper for RSI
const calculateRSI = (history: FuturesHistoryPoint[], period: number = 14) => {
    if (history.length < period + 1) return { value: 0, status: 'Neutral' };

    // Simple RSI calculation
    let gains = 0;
    let losses = 0;

    // First average
    for (let i = history.length - period; i < history.length; i++) {
        const change = history[i].close - history[i - 1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    // For more precision, we should do smoothing, but simple avg is okay for now on snapshot
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let status = 'Neutral';
    if (rsi > 70) status = 'Wykupiony (Overbought)';
    if (rsi < 30) status = 'Wyprzedany (Oversold)';

    return { value: rsi, status };
};

// Helper for ATR
const calculateATR = (history: FuturesHistoryPoint[], period: number = 14) => {
    if (history.length < period + 1) return { value: 0 };

    let sumTR = 0;
    // Calculate TR for last N days
    for (let i = history.length - period; i < history.length; i++) {
        const cp = history[i - 1].close;
        // Default to close if high/low missing
        const h = history[i].high ?? history[i].close;
        const l = history[i].low ?? history[i].close;

        const tr = Math.max(h - l, Math.abs(h - cp), Math.abs(l - cp));
        sumTR += tr;
    }

    return { value: sumTR / period };
};

export async function GET(request: NextRequest) {
    try {
        // 0. SECURITY: Authorization Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        try {
            await adminAuth.verifyIdToken(token);
        } catch (authError) {
            console.error('Auth verification failed:', authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const mainContract = searchParams.get('contract') || `BASE_Y-${(new Date().getFullYear() + 1).toString().slice(-2)}`;
        const targetDate = searchParams.get('date'); // Optional date filter (YYYY-MM-DD)

        // 0. SECURITY: Input Validation
        const contractRegex = /^BASE_[YQM]-(?:\d{1,2}-)?\d{2}$/;
        if (!contractRegex.test(mainContract)) {
            return NextResponse.json({ error: 'Invalid contract format' }, { status: 400 });
        }

        if (targetDate) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(targetDate)) {
                return NextResponse.json({ error: 'Invalid date format (KPI: YYYY-MM-DD)' }, { status: 400 });
            }
        }

        // 1. Fetch Main Contract History (Chart Data)
        const historySnapshot = await adminDb.collection('futures_data')
            .where('contract', '==', mainContract)
            .get();

        let sortedDocs = historySnapshot.docs.map(doc => doc.data()).sort((a, b) => a.date.localeCompare(b.date));

        // Filter history if targetDate is provided
        if (targetDate) {
            sortedDocs = sortedDocs.filter(d => d.date <= targetDate);
        }

        const history: FuturesHistoryPoint[] = [];
        let prevClose = 0;

        for (const d of sortedDocs) {
            const close = d.DKR || d.closingPrice || 0;
            if (close === 0) continue;

            const open = prevClose > 0 ? prevClose : close;

            history.push({
                date: d.date,
                open: open,
                high: d.maxPrice > 0 ? d.maxPrice : close,
                low: d.minPrice > 0 ? d.minPrice : close,
                close: close,
                volume: d.volume || 0,
                openInterest: d.openInterest || 0
            });
            prevClose = close;
        }

        // Determine reference dates from Main Contract History
        const latestDate = history.length > 0 ? history[history.length - 1].date : (targetDate || new Date().toISOString().split('T')[0]);
        const prevDate = history.length > 1 ? history[history.length - 2].date : null;

        // 2. Helper to fetch latest docs for curve/ticker WITHOUT requiring composite index
        const getLatestDocs = async (contractName: string, limit: number, maxDate?: string) => {
            const snap = await adminDb.collection('futures_data')
                .where('contract', '==', contractName)
                .get();

            if (snap.empty) return [];

            let docs = snap.docs.map(d => d.data());

            // Filter by maxDate if provided (Time Travel)
            if (maxDate) {
                docs = docs.filter(d => d.date <= maxDate);
            }

            // Sort desc by date
            docs.sort((a, b) => b.date.localeCompare(a.date));
            return docs.slice(0, limit);
        };

        const structure = getContractNames(new Date().getFullYear());
        const allForwardContracts = [...structure.months, ...structure.quarters, ...structure.years];

        // Fetch Forward Curve Data
        const curveData = [];
        for (const c of allForwardContracts) {
            const docs = await getLatestDocs(c.name, 15, latestDate);

            if (docs.length > 0) {
                const d = docs[0];
                let sma15 = 0;

                if (docs.length > 0) {
                    const sum = docs.reduce((acc, doc) => acc + (doc.DKR || doc.closingPrice || 0), 0);
                    sma15 = sum / docs.length;
                }

                curveData.push({
                    label: c.label,
                    period: c.label,
                    price: d.DKR || d.closingPrice || 0,
                    sma15: sma15,
                    contract: c.name
                });
            }
        }

        // 3. Fetch Ticker Data (ALL Contracts for latestDate)
        const ticker = [];

        if (latestDate) {
            // Fetch all contracts for "prev" date (change calc)
            const prevPrices = new Map<string, number>();
            const snapToday = await adminDb.collection('futures_data')
                .where('date', '==', latestDate)
                .get();

            if (prevDate) {
                const snapPrev = await adminDb.collection('futures_data')
                    .where('date', '==', prevDate)
                    .get();

                snapPrev.docs.forEach(d => {
                    const data = d.data();
                    prevPrices.set(data.contract, data.DKR || data.closingPrice || 0);
                });
            }

            ticker.push(...snapToday.docs.map(doc => {
                const d = doc.data();
                const currentPrice = d.DKR || d.closingPrice || 0;
                const prevPrice = prevPrices.get(d.contract) || currentPrice;

                const change = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

                return {
                    contract: d.contract,
                    last: currentPrice,
                    change: change,
                    open: d.minPrice,
                    max: d.maxPrice,
                    min: d.minPrice,
                    volume: d.volume || 0,
                    openInterest: d.openInterest || 0
                };
            }));

            ticker.sort((a, b) => a.contract.localeCompare(b.contract));
        }

        // 3. KPI Calculations
        const latestPoint = history[history.length - 1] as FuturesHistoryPoint | undefined;
        const prevPoint = (history.length > 1 ? history[history.length - 2] : undefined) as FuturesHistoryPoint | undefined;

        const peakContract = mainContract.replace('BASE', 'PEAK5');
        const peakDocs = await getLatestDocs(peakContract, 1, latestDate);
        const prevPeakDocs = prevDate ? await getLatestDocs(peakContract, 1, prevDate) : [];

        const peakPrice = peakDocs.length > 0 ? (peakDocs[0].DKR || 0) : 0;
        const prevPeakPrice = prevPeakDocs.length > 0 ? (prevPeakDocs[0].DKR || 0) : 0;

        const latestClose = latestPoint?.close ?? 0;
        const kpiPrevClose = prevPoint?.close ?? 0;

        const spread = (peakPrice > 0 && latestClose > 0) ? (peakPrice - latestClose) : 0;
        const prevSpread = (prevPeakPrice > 0 && kpiPrevClose > 0) ? (prevPeakPrice - kpiPrevClose) : 0;

        const spreadChange = spread - prevSpread;

        // --- TECHNICAL INDICATORS ---
        const rsi = calculateRSI(history, 14);
        const atr = calculateATR(history, 14);

        let calendarSpread = { value: 0, label: 'N/A' };
        const mainYearMatch = mainContract.match(/Y-(\d{2})/);
        if (mainYearMatch) {
            const currentY = parseInt(mainYearMatch[1]);
            const nextY = currentY + 1;
            const nextYearContract = mainContract.replace(currentY.toString(), nextY.toString());

            const nextYearDocs = await getLatestDocs(nextYearContract, 1, latestDate);
            if (nextYearDocs.length > 0 && latestPoint && latestPoint.close > 0) {
                const nextPrice = nextYearDocs[0].DKR || 0;
                const val = latestPoint.close - nextPrice;
                const type = val > 0 ? 'Backwardation' : 'Contango';
                calendarSpread = { value: val, label: type };
            }
        }

        // --- TREND STRENGTH (Price vs SMA50) ---
        let trend = { sma50: 0, diffPct: 0, status: 'Neutral' };
        if (history.length >= 50) {
            let sum = 0;
            for (let i = history.length - 50; i < history.length; i++) {
                sum += history[i].close;
            }
            const sma50 = sum / 50;
            const currentPrice = latestPoint?.close ?? 0;
            const diffPct = sma50 > 0 ? ((currentPrice - sma50) / sma50) * 100 : 0;
            trend = { sma50, diffPct, status: 'Neutral' };
        }

        // Map Trend Object to Enum
        let trendEnum = 'NEUTRAL';
        if (trend.diffPct > 5) trendEnum = 'BULLISH';
        if (trend.diffPct < -5) trendEnum = 'BEARISH';

        return NextResponse.json({
            history,
            forwardCurve: curveData,
            ticker,
            kpi: {
                basePrice: latestPoint?.close || 0,
                peakPrice: peakPrice,
                spread: spread,
                spreadChange: spreadChange,
                volume: latestPoint?.volume || 0,
                openInterest: latestPoint?.openInterest || 0
            },
            technical: {
                rsi: rsi.value,
                atr: atr.value,
                calendarSpread: calendarSpread.value,
                trend: trendEnum
            },
            effectiveDate: latestDate
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
