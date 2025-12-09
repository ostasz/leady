export interface DataPoint {
    price: number;
    [key: string]: any;
}

/**
 * Adds a 'trend' property to the data array using simple linear regression (Least Squares).
 */
export function addTrendLine(data: DataPoint[]): DataPoint[] {
    if (!data || data.length < 2) return data;

    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    // x is the index (0, 1, 2...)
    // y is the price
    for (let i = 0; i < n; i++) {
        const x = i;
        const y = data[i].price;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return data.map((point, index) => ({
        ...point,
        trend: slope * index + intercept
    }));
}
