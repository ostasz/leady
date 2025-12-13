export interface Lead {
    id: string;
    companyName: string;
    address: string | null;
    status: string;
    priority: string;
    scheduledDate: string | null; // ISO Date "YYYY-MM-DD"
    openingHours?: string[] | null;
    latitude?: number | null;
    longitude?: number | null;
    [key: string]: any;
}

export interface PlannerState {
    leads: Lead[];
    weekStart: Date;
    viewMode: 'calendar' | 'map';
}
