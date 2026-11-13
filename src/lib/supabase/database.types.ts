// ═══════════════════════════════════════════════════════
// Database schema types — mirrors supabase/migrations up to
// 20250101001600_production_hardening.sql (generated-types layout).
// Regenerate against a live DB with:
//   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
// and re-append the "Convenience aliases" block at the bottom.
// ═══════════════════════════════════════════════════════
import type {
  AppointmentStatus,
  BookingSource,
  LeadStage,
  NotificationType,
  PaymentMethod,
  UserRole,
} from "@/lib/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      shops: Table<
        {
          id: string;
          name: string;
          description: string | null;
          email: string | null;
          phone: string | null;
          whatsapp: string | null;
          address: string | null;
          instagram: string | null;
          google_maps_url: string | null;
          daily_goal: number | null;
          settings: Json | null;
          currency: string | null;
          timezone: string;
          require_deposit: boolean | null;
          deposit_type: "percentage" | "fixed" | null;
          deposit_value: number | null;
          cancellation_policy_hours: number | null;
          cancellation_fee_percent: number | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          name: string;
          description?: string | null;
          email?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          address?: string | null;
          instagram?: string | null;
          google_maps_url?: string | null;
          daily_goal?: number | null;
          settings?: Json | null;
          currency?: string | null;
          timezone?: string;
          require_deposit?: boolean | null;
          deposit_type?: "percentage" | "fixed" | null;
          deposit_value?: number | null;
          cancellation_policy_hours?: number | null;
          cancellation_fee_percent?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      profiles: Table<
        {
          id: string;
          shop_id: string | null;
          role: UserRole;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id: string;
          shop_id?: string | null;
          role?: UserRole;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      services: Table<
        {
          id: string;
          shop_id: string;
          name: string;
          name_ar: string | null;
          duration: number;
          price: number;
          icon: string | null;
          is_active: boolean | null;
          sort_order: number | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          name: string;
          name_ar?: string | null;
          duration: number;
          price: number;
          icon?: string | null;
          is_active?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      clients: Table<
        {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          /** Generated: digits of phone. Read-only. */
          phone_digits: string;
          email: string | null;
          notes: string | null;
          source: string | null;
          total_spend: number | null;
          /** Ownership key for customers. Set only by the DB (booking RPC / link_customer_client). */
          auth_user_id: string | null;
          /** Soft delete: filter `.is("deleted_at", null)`. */
          deleted_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          source?: string | null;
          total_spend?: number | null;
          deleted_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      appointments: Table<
        {
          id: string;
          shop_id: string;
          client_id: string | null;
          barber_id: string | null;
          service_ids: string[] | null;
          client_name: string | null;
          service_name: string | null;
          start_time: string;
          end_time: string;
          status: AppointmentStatus;
          price: number;
          currency: string | null;
          notes: string | null;
          source: string | null;
          payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded" | "no_show_charged" | null;
          payment_method: PaymentMethod | null;
          amount_total: number | null;
          amount_deposit: number | null;
          amount_paid: number | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          no_show: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          client_id?: string | null;
          barber_id?: string | null;
          service_ids?: string[] | null;
          client_name?: string | null;
          service_name?: string | null;
          start_time: string;
          end_time: string;
          status?: AppointmentStatus;
          price?: number;
          currency?: string | null;
          notes?: string | null;
          source?: string | null;
          payment_status?: "unpaid" | "deposit_paid" | "paid" | "refunded" | "no_show_charged" | null;
          payment_method?: PaymentMethod | null;
          amount_total?: number | null;
          amount_deposit?: number | null;
          amount_paid?: number | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          no_show?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      leads: Table<
        {
          id: string;
          shop_id: string;
          client_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          contact: string | null;
          stage: LeadStage;
          value: number | null;
          notes: string | null;
          position: number | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          client_id?: string | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          contact?: string | null;
          stage?: LeadStage;
          value?: number | null;
          notes?: string | null;
          position?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      daily_sales: Table<
        {
          id: string;
          shop_id: string;
          appointment_id: string | null;
          client_name: string;
          service_name: string;
          barber_name: string;
          amount: number;
          payment_method: PaymentMethod;
          sale_time: string | null;
          created_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          appointment_id?: string | null;
          client_name: string;
          service_name: string;
          barber_name: string;
          amount: number;
          payment_method: PaymentMethod;
          sale_time?: string | null;
          created_at?: string | null;
        }
      >;
      payments: Table<
        {
          id: string;
          shop_id: string;
          appointment_id: string | null;
          client_id: string | null;
          amount: number;
          currency: string;
          method: PaymentMethod;
          provider: string | null;
          provider_payment_intent_id: string | null;
          status: string;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          appointment_id?: string | null;
          client_id?: string | null;
          amount: number;
          currency?: string;
          method: PaymentMethod;
          provider?: string | null;
          provider_payment_intent_id?: string | null;
          status?: string;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      >;
      reviews: Table<
        {
          id: string;
          shop_id: string;
          client_id: string | null;
          appointment_id: string | null;
          rating: number;
          comment: string | null;
          /** Public display name ("Yousef R."). Use instead of embedding clients(name). */
          reviewer_name: string | null;
          created_at: string;
        },
        // Inserts go through the submit_review RPC only (no INSERT grant).
        never,
        never
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          shop_id: string | null;
          title: string;
          message: string;
          link: string | null;
          type: NotificationType | null;
          payload: Json;
          is_read: boolean | null;
          created_at: string;
        },
        never,
        { is_read?: boolean | null }
      >;
      working_hours: Table<
        {
          id: string;
          barber_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_working: boolean | null;
          break_start: string | null;
          break_end: string | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          barber_id: string;
          day_of_week: number;
          start_time?: string;
          end_time?: string;
          is_working?: boolean | null;
          break_start?: string | null;
          break_end?: string | null;
        }
      >;
      barber_services: Table<
        {
          id: string;
          barber_id: string;
          service_id: string;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          barber_id: string;
          service_id: string;
          is_active?: boolean | null;
        }
      >;
      invites: Table<
        {
          id: string;
          shop_id: string;
          token: string;
          role: "barber" | "shop_admin";
          status: "pending" | "accepted" | "expired" | "revoked";
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          expires_at: string | null;
        },
        {
          id?: string;
          shop_id: string;
          token: string;
          role?: "barber" | "shop_admin";
          status?: "pending" | "accepted" | "expired" | "revoked";
          expires_at?: string | null;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      get_busy_slots: {
        Args: { p_shop_id: string; p_day: string; p_barber_id?: string | null };
        Returns: BusySlot[];
      };
      create_public_booking: {
        Args: {
          p_shop_id: string;
          p_client_name: string;
          p_client_phone: string;
          p_service_ids: string[];
          p_barber_id: string | null;
          p_start_time: string;
          p_source?: BookingSource;
          p_notes?: string | null;
        };
        Returns: BookingResult;
      };
      cancel_customer_booking: {
        Args: { p_appointment_id: string; p_reason?: string | null };
        Returns: CancelBookingResult;
      };
      link_customer_client: { Args: Record<PropertyKey, never>; Returns: string | null };
      get_my_appointments: { Args: Record<PropertyKey, never>; Returns: MyAppointment[] };
      submit_review: {
        Args: { p_appointment_id: string; p_rating: number; p_comment?: string | null };
        Returns: string;
      };
      complete_appointment_sale: {
        Args: { p_appointment_id: string; p_payment_method: PaymentMethod; p_amount?: number | null };
        Returns: CompleteSaleResult;
      };
      get_invite_by_token: {
        Args: { p_token: string };
        Returns: { shop_id: string; role: "barber" | "shop_admin"; status: string; expires_at: string | null }[];
      };
      accept_invite: {
        Args: { p_token: string };
        Returns: { shop_id: string; role: "barber" | "shop_admin" }[];
      };
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      dashboard_metrics: { Args: { p_shop_id: string }; Returns: DashboardMetrics | null };
      /** Own shop's private fields (staff only; empty for everyone else). */
      get_my_shop_private: {
        Args: Record<PropertyKey, never>;
        Returns: { shop_id: string; daily_goal: number | null; settings: Json | null }[];
      };
      /** Phone numbers the caller may see: own row, plus the whole shop for staff. */
      get_profile_phones: { Args: Record<PropertyKey, never>; Returns: { id: string; phone: string | null }[] };
      get_current_shop_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      is_shop_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_shop_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// ─── Convenience aliases ───
type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type RpcArgs<F extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][F]["Args"];
export type RpcReturns<F extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][F]["Returns"];

/** get_busy_slots row — an occupied interval (pending/confirmed only). */
export interface BusySlot {
  barber_id: string | null;
  start_time: string;
  end_time: string;
}

/** create_public_booking result (jsonb object). */
export interface BookingResult {
  appointment_id: string;
  /** The concrete barber (resolved when "any" was requested). */
  barber_id: string;
  start_time: string;
  end_time: string;
  price: number;
  currency: string;
  service_name: string;
  status: "pending";
}

/** cancel_customer_booking result (jsonb object). */
export interface CancelBookingResult {
  appointment_id: string;
  status: "cancelled";
  cancelled_at: string;
}

/** complete_appointment_sale result (jsonb object). */
export interface CompleteSaleResult {
  appointment_id: string;
  sale_id: string;
  status: "completed";
  amount: number;
}

/** get_my_appointments row. */
export interface MyAppointment {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  shop_timezone: string;
  cancellation_policy_hours: number;
  barber_id: string | null;
  barber_name: string | null;
  client_name: string | null;
  service_name: string | null;
  service_ids: string[] | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  price: number;
  currency: string;
  source: string | null;
  cancelled_at: string | null;
  has_review: boolean;
}

/** dashboard_metrics result (jsonb object; shop time zone, weeks start Monday). */
export interface DashboardMetrics {
  today_bookings: number;
  yesterday_bookings: number;
  today_sales: number;
  yesterday_sales: number;
  week_sales: number;
  prev_week_sales: number;
  month_sales: number;
  prev_month_sales: number;
  daily_goal: number;
  currency: string;
  timezone: string;
}
