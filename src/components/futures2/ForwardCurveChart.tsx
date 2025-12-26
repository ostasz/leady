import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CurvePoint {
    label: string;
    price: number;
    sma15?: number;
    contract: string;
}

interface ForwardCurveProps {
    data: CurvePoint[];
}

export default function ForwardCurveChart({ data }: ForwardCurveProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-[#111827] p-4 rounded-xl shadow-sm border border-gray-800">
            <h3 className="text-white font-semibold mb-4">Krzywa Terminowa (Forward Curve)</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis
                            dataKey="label"
                            stroke="#4b5563"
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                        />
                        <YAxis
                            stroke="#4b5563"
                            domain={['auto', 'auto']}
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(val: number, name: string) => [
                                `${val.toFixed(2)} PLN`,
                                name === 'price' ? 'Cena' : (name === 'sma15' ? 'SMA15' : name)
                            ]}
                            labelStyle={{ color: '#9ca3af', marginBottom: '0.25rem' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="sma15"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={{ r: 4, fill: '#3b82f6' }}
                            name="sma15"
                        />
                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#009D8F"
                            strokeWidth={3}
                            dot={{ fill: '#009D8F', r: 4 }}
                            activeDot={{ r: 6, fill: '#009D8F' }}
                            name="price"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
