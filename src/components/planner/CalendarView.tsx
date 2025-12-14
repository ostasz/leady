import React from 'react';
import { Lead } from './types';
import { useDroppable } from '@dnd-kit/core';
import { format, addDays, startOfWeek } from 'date-fns';
import { pl } from 'date-fns/locale';

interface CalendarViewProps {
    weekStart: Date;
    scheduledLeads: Record<string, Lead[]>; // Key is YYYY-MM-DD
}

export const CalendarView: React.FC<CalendarViewProps> = ({ weekStart, scheduledLeads }) => {
    // Generate dates for Mon-Fri
    const days = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));

    return (
        <div className="flex-1 overflow-x-auto bg-gray-50/30">
            <div className="grid grid-cols-5 h-full min-w-[800px]">
                {days.map((date) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const leads = scheduledLeads[dateKey] || [];

                    return (
                        <DayColumn key={dateKey} date={date} id={dateKey} leads={leads} />
                    );
                })}
            </div>
        </div>
    );
};

interface DayColumnProps {
    date: Date;
    id: string; // YYYY-MM-DD
    leads: Lead[];
}

const DayColumn: React.FC<DayColumnProps> = ({ date, id, leads }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        data: { date: id, type: 'day-column' },
    });

    const isToday = format(new Date(), 'yyyy-MM-dd') === id;

    return (
        <div
            ref={setNodeRef}
            className={`
                flex flex-col border-r border-gray-200 h-full transition-colors
                ${isOver ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-200' : 'bg-white'}
                ${isToday ? 'bg-yellow-50/30' : ''}
            `}
        >
            <div className={`
                p-3 text-center border-b border-gray-100 flex flex-col items-center justify-center
                ${isToday ? 'bg-yellow-100/20' : ''}
            `}>
                <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">
                    {format(date, 'EEEE', { locale: pl })}
                </span>
                <span className={`
                    text-lg font-bold mt-1 h-8 w-8 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-primary text-white' : 'text-gray-800'}
                `}>
                    {format(date, 'd')}
                </span>
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {/* Provide visual cue if empty */}
                {leads.length === 0 && !isOver && (
                    <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-gray-300 text-2xl font-light">+</span>
                    </div>
                )}

                {leads.map(lead => (
                    // We need draggable items here too so we can move them BETWEEN days or back to unscheduled
                    <ScheduledLeadItem key={lead.id} lead={lead} />
                ))}
            </div>
        </div>
    );
};


// Simple display item, but should also be draggable ideally. 
// For MVP, lets make it static or reuse the Draggable logic if complex.
// Actually, it MUST be draggable to move between days. using same Draggable logic but styled differently?
import { useDraggable } from '@dnd-kit/core';

const ScheduledLeadItem: React.FC<{ lead: Lead }> = ({ lead }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: lead.id,
        data: { ...lead, type: 'lead' }, // Same type, so we can drop anywhere
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
    } : undefined;

    // Helper to extract city from address
    const getCityFromAddress = (address: string | null | undefined) => {
        if (!address) return '';
        const zipMatch = address.match(/\d{2}-\d{3}\s+([^\,]+)/);
        if (zipMatch && zipMatch[1]) {
            return zipMatch[1].trim();
        }
        const parts = address.split(',');
        if (parts.length > 1) {
            const last = parts[parts.length - 1].trim();
            if ((last.toLowerCase() === 'polska' || last.toLowerCase() === 'poland') && parts.length > 2) {
                return parts[parts.length - 2].trim();
            }
            return last;
        }
        return address;
    };

    const city = getCityFromAddress(lead.address);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                bg-white p-2.5 rounded shadow-sm border border-l-4 border-gray-100 cursor-grab hover:shadow-md group
                ${isDragging ? 'opacity-30' : ''}
                ${lead.priority === 'high' ? 'border-l-red-500' : 'border-l-primary'}
            `}
        >
            <div className="flex justify-between items-start">
                <div className="font-semibold text-sm text-gray-800 leading-tight">{lead.companyName}</div>
            </div>

            <div className="mt-1 flex flex-col gap-0.5">
                <div className="text-[10px] text-gray-500 truncate" title={lead.address || ''}>
                    {lead.address?.split(',')[0]}
                </div>
                {city && city !== lead.address?.split(',')[0] && (
                    <div className="text-[10px] font-semibold text-gray-700">
                        {city}
                    </div>
                )}
            </div>

            <div className="text-[10px] mt-1">
                {(() => {
                    if (!lead.openingHours || lead.openingHours.length === 0) {
                        return <span className="text-gray-900 font-medium">Brak danych</span>;
                    }

                    const mondayText = lead.openingHours[0];
                    if (!mondayText) return <span className="text-gray-900 font-medium">Brak danych</span>;

                    if (mondayText.toLowerCase().includes('zamknięte') || mondayText.toLowerCase().includes('closed')) {
                        return <span className="text-red-600 font-bold">Zamknięte</span>;
                    }

                    const timePart = mondayText.split(/:\s+/).slice(1).join(': ').trim();
                    const displayTime = timePart || mondayText;

                    return <span className="text-green-600 font-medium">{displayTime}</span>;
                })()}
            </div>
        </div>
    )
}
