// ═══════════════════════════════════════════════════════
// Shared types for the Halaqy application
// These replace the types previously in mock-data.ts
// ═══════════════════════════════════════════════════════

export type LeadStage = "new" | "contacted" | "booked" | "completed" | "regular";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  value?: number | null;
  stage: LeadStage;
  notes?: string | null;
  avatar?: string;
  createdAt: string;
  contact?: string | null;
}

export interface ChartDataPoint {
  label: string;
  revenue: number;
  bookings: number;
}
