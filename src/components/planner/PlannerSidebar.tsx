import React from 'react';
import { Lead } from './types';
import { DraggableLead } from './DraggableLead';
import { useDroppable } from '@dnd-kit/core';

interface PlannerSidebarProps {
    leads: Lead[];
}

export const PlannerSidebar: React.FC<PlannerSidebarProps> = ({ leads }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'unscheduled',
    });

    return (
        <div
            ref={setNodeRef}
            className={`w-full lg:w-64 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col shrink-0 transition-colors ${isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''}`}
        >
            <div className="px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="font-semibold text-gray-800 text-sm">Nieprzypisane Lead'y</h2>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{leads.length}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Przeciągnij na dzień tygodnia</div>
            </div>

            <div className="flex-1 lg:overflow-y-auto lg:p-3 p-2 overflow-x-auto lg:overflow-x-hidden flex lg:flex-col gap-3 scrollbar-hide snap-x snap-mandatory">
                {leads.length === 0 ? (
                    <div className="text-center text-gray-400 text-xs mt-4 lg:mt-10 p-4 border-2 border-dashed border-gray-200 rounded-lg mx-auto w-full">
                        Brak leadów 🎉
                    </div>
                ) : (
                    leads.map(lead => (
                        <div key={lead.id} className="snap-center shrink-0 w-[85vw] lg:w-full first:pl-2 last:pr-2 lg:first:pl-0 lg:last:pr-0">
                            <DraggableLead lead={lead} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
