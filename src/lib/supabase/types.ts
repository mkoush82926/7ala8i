export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LeadStage = "new" | "contacted" | "booked" | "completed" | "regular";
export type UserRole = "shop_admin" | "barber" | "customer";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

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
          source: string | null;
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
