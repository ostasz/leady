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
                bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-grab hover:shadow-md transition-all
                ${isDragging ? 'opacity-50 border-blue-400 rotate-2' : ''}
            `}
        >
            <div className="font-medium text-sm text-gray-800 truncate" title={lead.companyName}>
                {lead.companyName}
            </div>

            <div className="mt-1 flex flex-col gap-0.5">
                {/* Street (Truncated) */}
                <div className="text-[11px] text-gray-500 truncate" title={lead.address || ''}>
                    {lead.address?.split(',')[0]}
                </div>

                {/* City (Bolded/Highlighted per user request) */}
                {city && city !== lead.address?.split(',')[0] && (
                    <div className="text-[11px] font-semibold text-gray-700">
                        {city}
                    </div>
                )}

                {/* Opening Hours (Monday) */}
                <div className="text-[10px] mt-1">
                    {(() => {
                        if (!lead.openingHours || lead.openingHours.length === 0) {
                            return <span className="text-gray-900 font-medium">Brak danych</span>;
                        }

                        // Google Places weekday_text usually starts with Monday at index 0
                        // Format: "Monday: 09:00 – 17:00" or similar
                        const mondayText = lead.openingHours[0];

                        if (!mondayText) return <span className="text-gray-900 font-medium">Brak danych</span>;

                        if (mondayText.toLowerCase().includes('zamknięte') || mondayText.toLowerCase().includes('closed')) {
                            return <span className="text-red-600 font-bold">Zamknięte</span>;
                        }

                        // Extract time part: Remove "Poniedziałek: " or "Monday: " prefix
                        // Simple heuristic: split by first colon, take rest? Or just regex for digits.
                        // Example: "Poniedziałek: 08:00–16:00" -> "08:00–16:00"
                        const timePart = mondayText.split(/:\s+/).slice(1).join(': ').trim();

                        // If split didn't work (unexpected format), return whole string or fallback
                        const displayTime = timePart || mondayText;

                        return <span className="text-green-600 font-medium">{displayTime}</span>;
                    })()}
                </div>

                {/* Priority Badge */}
                <div className="flex justify-end mt-1">
                    <span className={`
                        text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold
                        ${lead.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'}
                    `}>
                        {lead.priority}
                    </span>
                </div>
            </div>
        </div>
    );
};
