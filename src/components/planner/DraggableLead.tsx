import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Lead } from './types';

interface DraggableLeadProps {
    lead: Lead;
}

export const DraggableLead: React.FC<DraggableLeadProps> = ({ lead }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: lead.id,
        data: { ...lead, type: 'lead' },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
    } : undefined;

    // Helper to extract city from address
    const getCityFromAddress = (address: string | null | undefined) => {
        if (!address) return '';

        // Try to find Polish zip code pattern "XX-XXX City"
        const zipMatch = address.match(/\d{2}-\d{3}\s+([^\,]+)/);
        if (zipMatch && zipMatch[1]) {
            return zipMatch[1].trim();
        }

        // Fallback: Try to take the part after the last comma (often country or city)
        const parts = address.split(',');
        if (parts.length > 1) {
            // Check if last part is Poland/Polska, if so take the one before
            const last = parts[parts.length - 1].trim();
            if ((last.toLowerCase() === 'polska' || last.toLowerCase() === 'poland') && parts.length > 2) {
                return parts[parts.length - 2].trim();
            }
            return last;
        }

        return address;
    };

    const city = getCityFromAddress(lead.address);
    const street = lead.address?.replace(city, '').replace(/\d{2}-\d{3}/, '').replace(/,\s*$/, '').trim() || lead.address?.split(',')[0];

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                bg-white p-3 rounded-xl shadow-sm border border-gray-100 cursor-grab hover:shadow-md transition-all relative overflow-hidden group
                ${isDragging ? 'opacity-50 border-blue-400 rotate-2' : ''}
            `}
        >
            <div className="flex justify-between items-start gap-2">
                {/* Left Side: Name & Address */}
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-bold text-sm text-gray-900 truncate leading-tight" title={lead.companyName}>
                        {lead.companyName}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5" title={lead.address || ''}>
                        {lead.address?.split(',')[0]}
                    </div>
                </div>

                {/* Right Side: City, Status & Badge */}
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                    {/* City */}
                    {city && (
                        <div className="text-xs font-bold text-gray-800">
                            {city}
                        </div>
                    )}

                    {/* Opening Hours Info */}
                    <div className="text-[10px] font-medium">
                        {(() => {
                            if (!lead.openingHours || lead.openingHours.length === 0) {
                                return <span className="text-gray-400">Brak danych</span>;
                            }
                            const mondayText = lead.openingHours[0];
                            if (!mondayText) return <span className="text-gray-400">Brak danych</span>;

                            if (mondayText.toLowerCase().includes('zamknięte') || mondayText.toLowerCase().includes('closed')) {
                                return <span className="text-red-600">Zamknięte</span>;
                            }

                            const timePart = mondayText.split(/:\s+/).slice(1).join(': ').trim();
                            return <span className="text-green-600">{timePart || 'Otwarte'}</span>;
                        })()}
                    </div>
                </div>
            </div>

            {/* Priority Indicator Dot */}
            <div className={`
                absolute top-2 right-2 w-1.5 h-1.5 rounded-full
                ${lead.priority === 'high' ? 'bg-red-500' : 'hidden'}
            `} />
        </div>
    );
};
