export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Loose, hand-maintained row shapes used to parameterize the cookie-bound
// server client (src/lib/supabase/server.ts). The complete, generated-style
// schema incl. RPC signatures lives in ./database.types.ts.
import type { AppointmentStatus, LeadStage, UserRole } from "@/lib/types";
export type { AppointmentStatus, LeadStage, UserRole };

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          currency: string;
          email: string | null;
          phone: string | null;
          instagram: string | null;
          google_maps_url: string | null;
          whatsapp: string | null;
          description: string | null;
          timezone: string;
          cancellation_policy_hours: number | null;
          cancellation_fee_percent: number | null;
          daily_goal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          currency?: string;
          email?: string | null;
          phone?: string | null;
          instagram?: string | null;
          google_maps_url?: string | null;
          daily_goal?: number;
        };
        Update: {
          name?: string;
          address?: string | null;
          currency?: string;
          email?: string | null;
          phone?: string | null;
          instagram?: string | null;
          google_maps_url?: string | null;
          daily_goal?: number;
        };
      };
      profiles: {
        Row: {
          id: string;
          shop_id: string | null;
          role: UserRole;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          shop_id?: string | null;
          role?: UserRole;
          full_name: string;
          avatar_url?: string | null;
        };
        Update: {
          shop_id?: string | null;
          role?: UserRole;
          full_name?: string;
          avatar_url?: string | null;
        };
      };
      services: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          name_ar: string | null;
          duration: number;
          price: number;
          icon: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          name_ar?: string | null;
          duration: number;
          price: number;
          icon?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          name_ar?: string | null;
          duration?: number;
          price?: number;
          icon?: string;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      clients: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          source: string | null;
          total_spend: number;
          auth_user_id: string | null;
          phone_digits: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          source?: string | null;
          total_spend?: number;
        };
        Update: {
          name?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          source?: string | null;
          total_spend?: number;
        };
      };
      appointments: {
        Row: {
          id: string;
          shop_id: string;
          client_id: string | null;
          barber_id: string | null;
          service_ids: string[];
          client_name: string;
          start_time: string;
          end_time: string;
          status: AppointmentStatus;
          price: number;
          currency: string | null;
          service_name: string | null;
          notes: string | null;
          source: string | null;
          payment_status: string | null;
          payment_method: string | null;
          amount_total: number | null;
          amount_paid: number | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          no_show: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          client_id?: string | null;
          barber_id?: string | null;
          service_ids?: string[];
          client_name: string;
          start_time: string;
          end_time: string;
          status?: AppointmentStatus;
          price: number;
          source?: string | null;
        };
        Update: {
          client_id?: string | null;
          barber_id?: string | null;
          service_ids?: string[];
          client_name?: string;
          start_time?: string;
          end_time?: string;
          status?: AppointmentStatus;
          price?: number;
          source?: string | null;
        };
      };
      leads: {
        Row: {
          id: string;
          shop_id: string;
          client_id: string | null;
          name: string;
          contact: string | null;
          stage: LeadStage;
          value: number;
          notes: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          client_id?: string | null;
          name: string;
          contact?: string | null;
          stage?: LeadStage;
          value?: number;
          notes?: string | null;
          position?: number;
        };
        Update: {
          client_id?: string | null;
          name?: string;
          contact?: string | null;
          stage?: LeadStage;
          value?: number;
          notes?: string | null;
          position?: number;
        };
      };
      daily_sales: {
        Row: {
          id: string;
          shop_id: string;
          appointment_id: string | null;
          client_name: string;
          service_name: string;
          barber_name: string;
          amount: number;
          payment_method: string;
          sale_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          appointment_id?: string | null;
          client_name: string;
          service_name: string;
          barber_name: string;
          amount: number;
          payment_method: string;
          sale_time: string;
        };
        Update: {
          amount?: number;
          payment_method?: string;
        };
      };
    };
  };
}

export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type ClientRecord = Database["public"]["Tables"]["clients"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type DailySale = Database["public"]["Tables"]["daily_sales"]["Row"];
