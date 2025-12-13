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
            className={`w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 transition-colors h-[calc(100vh-64px)] overflow-hidden hidden lg:flex ${isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''}`}
        >
            <div className="p-4 border-b border-gray-200 bg-white">
                <h2 className="font-semibold text-gray-700">Nieprzypisane Lead'y</h2>
                <div className="text-xs text-gray-500 mt-1">{leads.length} do zaplanowania</div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {leads.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm mt-10 p-4 border-2 border-dashed border-gray-200 rounded-lg mx-2">
                        Brak leadów do zaplanowania 🎉
                    </div>
                ) : (
                    leads.map(lead => (
                        <DraggableLead key={lead.id} lead={lead} />
                    ))
                )}
            </div>
        </div>
    );
};
