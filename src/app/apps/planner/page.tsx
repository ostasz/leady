'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { PlannerSidebar } from '@/components/planner/PlannerSidebar';
import { CalendarView } from '@/components/planner/CalendarView';
import { MapView } from '@/components/planner/MapView';
import { Lead } from '@/components/planner/types';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core';
import { startOfWeek, format, parseISO, addWeeks, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Map as MapIcon, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';

export default function PlannerPage() {
    const { user, getAuthHeaders } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [viewMode, setViewMode] = useState<'calendar' | 'map'>('calendar');
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch leads
    useEffect(() => {
        if (!user) return;
        fetchLeads();
    }, [user]);

    const fetchLeads = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/leads', { headers }); // Assuming this fetches my leads
            const data = await res.json();
            if (data.leads) {
                setLeads(data.leads);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handlePreviousWeek = () => {
        setWeekStart(prev => addWeeks(prev, -1));
    };

    const handleNextWeek = () => {
        setWeekStart(prev => addWeeks(prev, 1));
    };

    // Derived states
    const unscheduledLeads = leads.filter(l => !l.scheduledDate);

    // Group scheduled leads by date
    const scheduledLeads: Record<string, Lead[]> = {};
    leads.filter(l => l.scheduledDate).forEach(l => {
        const date = l.scheduledDate!.split('T')[0]; // Handle timestamp vs date string
        if (!scheduledLeads[date]) scheduledLeads[date] = [];
        scheduledLeads[date].push(l);
    });

    // Drag & Drop Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const lead = leads.find(l => l.id === active.id);
        if (lead) setActiveDragLead(lead);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragLead(null);

        if (!over) return;

        const leadId = active.id as string;
        // 'over.id' should be the date string (YYYY-MM-DD) or 'backlog' (if we implement dropping back to sidebar)
        // Assuming droppable id is the Date String
        const targetDate = over.id as string;

        // Check if we dropped on 'unscheduled' sidebar
        if (targetDate === 'unscheduled') {
            setLeads(prev => prev.map(l => {
                if (l.id === leadId) {
                    return { ...l, scheduledDate: null };
                }
                return l;
            }));

            try {
                const headers = await getAuthHeaders();
                await fetch(`/api/leads/${leadId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ scheduledDate: null })
                });
            } catch (e) {
                console.error('Failed to unschedule lead', e);
            }
            return;
        }

        // Check if we dropped on a valid date column
        if (targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Optimistic update
            setLeads(prev => prev.map(l => {
                if (l.id === leadId) {
                    return { ...l, scheduledDate: targetDate };
                }
                return l;
            }));

            // Backend update
            try {
                const headers = await getAuthHeaders();
                await fetch(`/api/leads/${leadId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ scheduledDate: targetDate })
                });
            } catch (e) {
                console.error('Failed to update lead date', e);
                // Revert? (Not implemented for MVP)
            }
        }
    };

    const weekEnd = addDays(weekStart, 4); // Friday

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header */}
            <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <Home size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-gray-800">Planer Tras</h1>

                    {/* Date Nav */}
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 ml-8">
                        <button
                            onClick={handlePreviousWeek}
                            className="p-1 hover:bg-white rounded shadow-sm text-gray-500 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm font-medium px-2 text-gray-700 min-w-[200px] text-center capitalize">
                            {format(weekStart, 'd MMMM', { locale: pl })} - {format(weekEnd, 'd MMMM yyyy', { locale: pl })}
                        </span>
                        <button
                            onClick={handleNextWeek}
                            className="p-1 hover:bg-white rounded shadow-sm text-gray-500 transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {/* View Switcher */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`
                            flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                            ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}
                        `}
                    >
                        <Calendar size={16} />
                        Kalendarz
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`
                            flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                            ${viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}
                        `}
                    >
                        <MapIcon size={16} />
                        Mapa
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar (Always visible in Calendar mode, maybe hidden in Map mode if not needed? 
                        Prompt says: "Left sidebar (20%) showing a list titled 'Unscheduled Leads'".
                        In Map mode, Prompt says: "Left side (sidebar panel): Itinerary".
                        So Sidebar changes content based on View Mode.
                    */}

                    {viewMode === 'calendar' && (
                        <>
                            <PlannerSidebar leads={unscheduledLeads} />
                            <CalendarView weekStart={weekStart} scheduledLeads={scheduledLeads} />
                        </>
                    )}

                    {viewMode === 'map' && (
                        <MapView weekStart={weekStart} scheduledLeads={scheduledLeads} />
                    )}
                </div>

                {/* Drag Overlay */}
                {mounted && createPortal(
                    <DragOverlay>
                        {activeDragLead && (
                            <div className="bg-white p-3 rounded-lg shadow-xl border-2 border-blue-500 opacity-90 w-[250px] rotate-3 cursor-grabbing">
                                <div className="font-medium text-sm text-gray-900">{activeDragLead.companyName}</div>
                                <div className="text-xs text-gray-500">{activeDragLead.address}</div>
                            </div>
                        )}
                    </DragOverlay>,
                    document.body
                )}
            </DndContext>
        </div>
    );
}
