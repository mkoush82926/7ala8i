// ═══════════════════════════════════════════════════════
// Database schema types — GENERATED from the local stack after
// 20250101003200_gate1b_integration.sql:
//   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
// then re-append the "Convenience aliases" block at the bottom (hand-written).
// ═══════════════════════════════════════════════════════
import type { AppointmentStatus } from "@/lib/types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          diff: Json
          id: string
          impersonation_id: string | null
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          diff?: Json
          id?: string
          impersonation_id?: string | null
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          diff?: Json
          id?: string
          impersonation_id?: string | null
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_impersonation_sessions: {
        Row: {
          actor_id: string
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          mode: string
          reason: string | null
          shop_id: string
          started_at: string
        }
        Insert: {
          actor_id: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at: string
          id?: string
          mode?: string
          reason?: string | null
          shop_id: string
          started_at?: string
        }
        Update: {
          actor_id?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: string
          reason?: string | null
          shop_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      appointment_services: {
        Row: {
          appointment_id: string
          barber_id: string | null
          client_note: string | null
          created_at: string
          duration: number
          id: string
          name: string | null
          name_ar: string | null
          price: number
          service_id: string | null
          shop_id: string
          sort: number
          variant_id: string | null
        }
        Insert: {
          appointment_id: string
          barber_id?: string | null
          client_note?: string | null
          created_at?: string
          duration?: number
          id?: string
          name?: string | null
          name_ar?: string | null
          price?: number
          service_id?: string | null
          shop_id: string
          sort?: number
          variant_id?: string | null
        }
        Update: {
          appointment_id?: string
          barber_id?: string | null
          client_note?: string | null
          created_at?: string
          duration?: number
          id?: string
          name?: string | null
          name_ar?: string | null
          price?: number
          service_id?: string | null
          shop_id?: string
          sort?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_deposit: number | null
          amount_paid: number | null
          amount_total: number | null
          arrived_at: string | null
          barber_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          currency: string | null
          date: string | null
          end_time: string
          id: string
          manage_token: string | null
          no_show: boolean | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          price: number
          service_ids: string[]
          service_name: string | null
          shop_id: string
          source: string | null
          start_time: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount_deposit?: number | null
          amount_paid?: number | null
          amount_total?: number | null
          arrived_at?: string | null
          barber_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string | null
          end_time: string
          id?: string
          manage_token?: string | null
          no_show?: boolean | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number
          service_ids?: string[]
          service_name?: string | null
          shop_id: string
          source?: string | null
          start_time: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount_deposit?: number | null
          amount_paid?: number | null
          amount_total?: number | null
          arrived_at?: string | null
          barber_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string | null
          end_time?: string
          id?: string
          manage_token?: string | null
          no_show?: boolean | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number
          service_ids?: string[]
          service_name?: string | null
          shop_id?: string
          source?: string | null
          start_time?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          city_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name_ar: string
          name_en: string
          slug_ar: string
          slug_en: string
          sort: number
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_ar: string
          name_en: string
          slug_ar: string
          slug_en: string
          sort?: number
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_ar?: string
          name_en?: string
          slug_ar?: string
          slug_en?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "areas_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      banned_phones: {
        Row: {
          created_at: string
          created_by: string | null
          phone_hint: string | null
          phone_key: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          phone_hint?: string | null
          phone_key: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          phone_hint?: string | null
          phone_key?: string
          reason?: string
        }
        Relationships: []
      }
      barber_services: {
        Row: {
          barber_id: string
          created_at: string | null
          duration_override: number | null
          id: string
          is_active: boolean | null
          price_override: number | null
          service_id: string
          updated_at: string | null
        }
        Insert: {
          barber_id: string
          created_at?: string | null
          duration_override?: number | null
          id?: string
          is_active?: boolean | null
          price_override?: number | null
          service_id: string
          updated_at?: string | null
        }
        Update: {
          barber_id?: string
          created_at?: string | null
          duration_override?: number | null
          id?: string
          is_active?: boolean | null
          price_override?: number | null
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          calendar_color: string | null
          calendar_order: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          profile_id: string | null
          shop_id: string
        }
        Insert: {
          calendar_color?: string | null
          calendar_order?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          profile_id?: string | null
          shop_id: string
        }
        Update: {
          calendar_color?: string | null
          calendar_order?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          profile_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barbers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_time_types: {
        Row: {
          created_at: string
          default_minutes: number
          emoji: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          name_ar: string | null
          name_en: string
          shop_id: string
          sort_order: number
          system_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_minutes?: number
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name_ar?: string | null
          name_en: string
          shop_id: string
          sort_order?: number
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_minutes?: number
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name_ar?: string | null
          name_en?: string
          shop_id?: string
          sort_order?: number
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_time_types_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          allow_online: boolean
          barber_id: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          rrule: string | null
          series_id: string | null
          shop_id: string
          source: string
          start_time: string
          title: string | null
          type_id: string | null
          updated_at: string
        }
        Insert: {
          allow_online?: boolean
          barber_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          rrule?: string | null
          series_id?: string | null
          shop_id: string
          source?: string
          start_time: string
          title?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_online?: boolean
          barber_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          rrule?: string | null
          series_id?: string | null
          shop_id?: string
          source?: string
          start_time?: string
          title?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "blocked_time_types"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_attribution: {
        Row: {
          appointment_id: string
          barber_preselected: boolean
          created_at: string
          entry: string | null
          phone_verified: boolean
          shop_id: string
          src: string | null
        }
        Insert: {
          appointment_id: string
          barber_preselected?: boolean
          created_at?: string
          entry?: string | null
          phone_verified?: boolean
          shop_id: string
          src?: string | null
        }
        Update: {
          appointment_id?: string
          barber_preselected?: boolean
          created_at?: string
          entry?: string | null
          phone_verified?: boolean
          shop_id?: string
          src?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_attribution_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_attribution_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          governorate: string
          id: string
          lat: number | null
          lng: number | null
          name_ar: string
          name_en: string
          slug_ar: string
          slug_en: string
          sort: number
        }
        Insert: {
          created_at?: string
          governorate: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_ar: string
          name_en: string
          slug_ar: string
          slug_en: string
          sort?: number
        }
        Update: {
          created_at?: string
          governorate?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_ar?: string
          name_en?: string
          slug_ar?: string
          slug_en?: string
          sort?: number
        }
        Relationships: []
      }
      claim_disputes: {
        Row: {
          claimant_name: string
          claimant_phone: string | null
          claimant_profile_id: string | null
          created_at: string
          created_by: string | null
          details: string
          id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          claimant_name: string
          claimant_phone?: string | null
          claimant_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          details: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          claimant_name?: string
          claimant_phone?: string | null
          claimant_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_disputes_claimant_profile_id_fkey"
            columns: ["claimant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_disputes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profile_links: {
        Row: {
          client_id: string
          linked_at: string
          method: string
          profile_id: string
          shop_id: string
        }
        Insert: {
          client_id: string
          linked_at?: string
          method?: string
          profile_id: string
          shop_id: string
        }
        Update: {
          client_id?: string
          linked_at?: string
          method?: string
          profile_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profile_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profile_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profile_links_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          phone_digits: string | null
          preferred_language: string | null
          shop_id: string
          source: string | null
          total_spend: number | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          phone_digits?: string | null
          preferred_language?: string | null
          shop_id: string
          source?: string | null
          total_spend?: number | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          phone_digits?: string | null
          preferred_language?: string | null
          shop_id?: string
          source?: string | null
          total_spend?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          note_ar: string | null
          note_en: string | null
          shop_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          note_ar?: string | null
          note_en?: string | null
          shop_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          note_ar?: string | null
          note_en?: string | null
          shop_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closed_periods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          channel: string | null
          created_at: string
          granted: boolean
          id: string
          policy_version: string | null
          profile_id: string
          purpose: string
          source: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          granted: boolean
          id?: string
          policy_version?: string | null
          profile_id: string
          purpose: string
          source: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          granted?: boolean
          id?: string
          policy_version?: string | null
          profile_id?: string
          purpose?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_verified_phones: {
        Row: {
          method: string
          phone: string
          phone_key: string
          profile_id: string
          verified_at: string
        }
        Insert: {
          method?: string
          phone: string
          phone_key: string
          profile_id: string
          verified_at?: string
        }
        Update: {
          method?: string
          phone?: string
          phone_key?: string
          profile_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_verified_phones_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_legacy: {
        Row: {
          amount: number
          appointment_id: string | null
          barber_name: string
          client_name: string
          created_at: string | null
          id: string
          payment_method: string
          sale_time: string
          service_name: string
          shop_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          barber_name: string
          client_name: string
          created_at?: string | null
          id?: string
          payment_method: string
          sale_time: string
          service_name: string
          shop_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          barber_name?: string
          client_name?: string
          created_at?: string | null
          id?: string
          payment_method?: string
          sale_time?: string
          service_name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          role: string
          shop_id: string
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          role?: string
          shop_id: string
          status?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          role?: string
          shop_id?: string
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_id: string | null
          contact: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          position: number | null
          shop_id: string
          stage: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          client_id?: string | null
          contact?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          position?: number | null
          shop_id: string
          stage?: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          client_id?: string | null
          contact?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          position?: number | null
          shop_id?: string
          stage?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      link_visits: {
        Row: {
          entry: string | null
          id: string
          shop_id: string
          src: string
          visited_at: string
        }
        Insert: {
          entry?: string | null
          id?: string
          shop_id: string
          src?: string
          visited_at?: string
        }
        Update: {
          entry?: string | null
          id?: string
          shop_id?: string
          src?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_visits_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_consents: {
        Row: {
          channel: string
          client_id: string
          opted_in: boolean
          shop_id: string
          source: string
          updated_at: string
        }
        Insert: {
          channel?: string
          client_id: string
          opted_in: boolean
          shop_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          opted_in?: boolean
          shop_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_consents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      message_allowances: {
        Row: {
          monthly_allowance: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          monthly_allowance?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          monthly_allowance?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_allowances_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      message_inbound: {
        Row: {
          action: string | null
          body: string | null
          channel: string
          context_msg_id: string | null
          from_phone: string
          id: string
          kind: string
          payload: string | null
          provider_msg_id: string | null
          received_at: string
          shop_id: string | null
        }
        Insert: {
          action?: string | null
          body?: string | null
          channel?: string
          context_msg_id?: string | null
          from_phone: string
          id?: string
          kind?: string
          payload?: string | null
          provider_msg_id?: string | null
          received_at?: string
          shop_id?: string | null
        }
        Update: {
          action?: string | null
          body?: string | null
          channel?: string
          context_msg_id?: string | null
          from_phone?: string
          id?: string
          kind?: string
          payload?: string | null
          provider_msg_id?: string | null
          received_at?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_inbound_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      message_outbox: {
        Row: {
          appointment_id: string | null
          attempts: number
          body: string | null
          category: string
          channel: string
          client_id: string | null
          cost_fils: number
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          delivered_at: string | null
          error: string | null
          id: string
          locale: string
          locked_at: string | null
          offset_minutes: number
          payload: Json
          provider: string | null
          provider_msg_id: string | null
          read_at: string | null
          recipient_profile_id: string | null
          sale_id: string | null
          scheduled_for: string
          sent_at: string | null
          shop_id: string
          status: string
          template: string
          template_version: number
          to_phone: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          body?: string | null
          category?: string
          channel?: string
          client_id?: string | null
          cost_fils?: number
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          locale?: string
          locked_at?: string | null
          offset_minutes?: number
          payload?: Json
          provider?: string | null
          provider_msg_id?: string | null
          read_at?: string | null
          recipient_profile_id?: string | null
          sale_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          shop_id: string
          status?: string
          template: string
          template_version?: number
          to_phone?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          body?: string | null
          category?: string
          channel?: string
          client_id?: string | null
          cost_fils?: number
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          locale?: string
          locked_at?: string | null
          offset_minutes?: number
          payload?: Json
          provider?: string | null
          provider_msg_id?: string | null
          read_at?: string | null
          recipient_profile_id?: string | null
          sale_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          shop_id?: string
          status?: string
          template?: string
          template_version?: number
          to_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_runtime: {
        Row: {
          id: number
          last_result: Json
          last_run_at: string | null
          providers: string[]
        }
        Insert: {
          id?: number
          last_result?: Json
          last_run_at?: string | null
          providers?: string[]
        }
        Update: {
          id?: number
          last_result?: Json
          last_run_at?: string | null
          providers?: string[]
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          event: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          event: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          event?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          payload: Json
          shop_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          payload?: Json
          shop_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          payload?: Json
          shop_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          data: Json
          shop_id: string
          started_by: string | null
          step: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data?: Json
          shop_id: string
          started_by?: string | null
          step?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data?: Json
          shop_id?: string
          started_by?: string | null
          step?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          cliq_alias: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          kind: string
          name_ar: string
          name_en: string
          qr_url: string | null
          shop_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          cliq_alias?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind?: string
          name_ar: string
          name_en: string
          qr_url?: string | null
          shop_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          cliq_alias?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind?: string
          name_ar?: string
          name_en?: string
          qr_url?: string | null
          shop_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          client_id: string | null
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          method: string
          provider: string | null
          provider_payment_intent_id: string | null
          shop_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          method: string
          provider?: string | null
          provider_payment_intent_id?: string | null
          shop_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          method?: string
          provider?: string | null
          provider_payment_intent_id?: string | null
          shop_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone_key: string
          token_hash: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone_key: string
          token_hash?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone_key?: string
          token_hash?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          barber_id: string | null
          blur_data: string | null
          caption: string | null
          caption_ar: string | null
          created_at: string
          created_by: string | null
          id: string
          is_featured: boolean
          path: string
          service_id: string | null
          shop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          barber_id?: string | null
          blur_data?: string | null
          caption?: string | null
          caption_ar?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_featured?: boolean
          path: string
          service_id?: string | null
          shop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          barber_id?: string | null
          blur_data?: string | null
          caption?: string | null
          caption_ar?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_featured?: boolean
          path?: string
          service_id?: string | null
          shop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_block_rules: {
        Row: {
          allow_online: boolean
          created_at: string
          enabled: boolean
          jumuah_minutes: number
          minutes: number
          prayer: string
          shop_id: string
          start_offset_minutes: number
          updated_at: string
        }
        Insert: {
          allow_online?: boolean
          created_at?: string
          enabled?: boolean
          jumuah_minutes?: number
          minutes?: number
          prayer: string
          shop_id: string
          start_offset_minutes?: number
          updated_at?: string
        }
        Update: {
          allow_online?: boolean
          created_at?: string
          enabled?: boolean
          jumuah_minutes?: number
          minutes?: number
          prayer?: string
          shop_id?: string
          start_offset_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_block_rules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_time_cache: {
        Row: {
          asr: string
          city_id: string
          computed_at: string
          date: string
          dhuhr: string
          fajr: string
          isha: string
          maghrib: string
          method: string
          sunrise: string
        }
        Insert: {
          asr: string
          city_id: string
          computed_at?: string
          date: string
          dhuhr: string
          fajr: string
          isha: string
          maghrib: string
          method?: string
          sunrise: string
        }
        Update: {
          asr?: string
          city_id?: string
          computed_at?: string
          date?: string
          dhuhr?: string
          fajr?: string
          isha?: string
          maghrib?: string
          method?: string
          sunrise?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_time_cache_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string | null
          name_en: string
          price: number
          shop_id: string
          sku: string | null
          sort: number
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          price?: number
          shop_id: string
          sku?: string | null
          sort?: number
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          price?: number
          shop_id?: string
          sku?: string | null
          sort?: number
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_assignable: boolean
          avatar_url: string | null
          banned_at: string | null
          bio_ar: string | null
          bio_en: string | null
          calendar_color: string | null
          calendar_order: number | null
          created_at: string | null
          digit_preference: string
          full_name: string
          handle: string | null
          id: string
          is_public: boolean
          languages: string[]
          marketing_opt_in: boolean
          notify_channel: string
          notify_reminders: boolean
          online_bookable: boolean
          phone: string | null
          platform_role: string | null
          preferred_language: string | null
          role: string
          shop_id: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          auto_assignable?: boolean
          avatar_url?: string | null
          banned_at?: string | null
          bio_ar?: string | null
          bio_en?: string | null
          calendar_color?: string | null
          calendar_order?: number | null
          created_at?: string | null
          digit_preference?: string
          full_name: string
          handle?: string | null
          id: string
          is_public?: boolean
          languages?: string[]
          marketing_opt_in?: boolean
          notify_channel?: string
          notify_reminders?: boolean
          online_bookable?: boolean
          phone?: string | null
          platform_role?: string | null
          preferred_language?: string | null
          role?: string
          shop_id?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          auto_assignable?: boolean
          avatar_url?: string | null
          banned_at?: string | null
          bio_ar?: string | null
          bio_en?: string | null
          calendar_color?: string | null
          calendar_order?: number | null
          created_at?: string | null
          digit_preference?: string
          full_name?: string
          handle?: string | null
          id?: string
          is_public?: boolean
          languages?: string[]
          marketing_opt_in?: boolean
          notify_channel?: string
          notify_reminders?: boolean
          online_bookable?: boolean
          phone?: string | null
          platform_role?: string | null
          preferred_language?: string | null
          role?: string
          shop_id?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      push_dispatch_config: {
        Row: {
          dispatch_url: string | null
          id: boolean
          secret: string | null
          updated_at: string
        }
        Insert: {
          dispatch_url?: string | null
          id?: boolean
          secret?: string | null
          updated_at?: string
        }
        Update: {
          dispatch_url?: string | null
          id?: boolean
          secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          keys: Json
          last_failure_at: string | null
          last_success_at: string | null
          locale: string
          profile_id: string
          shop_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          keys: Json
          last_failure_at?: string | null
          last_success_at?: string | null
          locale?: string
          profile_id: string
          shop_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          keys?: Json
          last_failure_at?: string | null
          last_success_at?: string | null
          locale?: string
          profile_id?: string
          shop_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      receipt_sequences: {
        Row: {
          last_no: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          last_no?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          last_no?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_sequences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          reporter_kind: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          shop_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          reporter_kind?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          shop_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          reporter_kind?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          comment: string | null
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          rating: number
          reviewer_name: string | null
          shop_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          rating: number
          reviewer_name?: string | null
          shop_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          rating?: number
          reviewer_name?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          barber_id: string | null
          cart_discount: number
          created_at: string
          discount_amount: number
          discount_reason: string | null
          id: string
          kind: string
          line_total: number
          name: string
          name_ar: string | null
          product_id: string | null
          quantity: number
          sale_id: string
          service_id: string | null
          shop_id: string
          sort: number
          tax_amount: number
          tax_rate: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          barber_id?: string | null
          cart_discount?: number
          created_at?: string
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          kind: string
          line_total: number
          name: string
          name_ar?: string | null
          product_id?: string | null
          quantity?: number
          sale_id: string
          service_id?: string | null
          shop_id: string
          sort?: number
          tax_amount?: number
          tax_rate?: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          barber_id?: string | null
          cart_discount?: number
          created_at?: string
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          kind?: string
          line_total?: number
          name?: string
          name_ar?: string | null
          product_id?: string | null
          quantity?: number
          sale_id?: string
          service_id?: string | null
          shop_id?: string
          sort?: number
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "daily_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method_code: string
          method_id: string | null
          reference: string | null
          sale_id: string
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method_code: string
          method_id?: string | null
          reference?: string | null
          sale_id: string
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method_code?: string
          method_id?: string | null
          reference?: string | null
          sale_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "daily_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_tips: {
        Row: {
          amount: number
          barber_id: string | null
          created_at: string
          id: string
          sale_id: string
          shop_id: string
        }
        Insert: {
          amount: number
          barber_id?: string | null
          created_at?: string
          id?: string
          sale_id: string
          shop_id: string
        }
        Update: {
          amount?: number
          barber_id?: string | null
          created_at?: string
          id?: string
          sale_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_tips_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tips_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "daily_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tips_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tips_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          appointment_id: string | null
          barber_name: string
          client_id: string | null
          client_name: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_reason: string | null
          discount_total: number
          id: string
          is_legacy: boolean
          note: string | null
          paid_total: number
          payment_method: string | null
          receipt_no: number | null
          receipt_number: string | null
          rounding_adjustment: number
          sale_time: string
          shop_id: string
          status: string
          subtotal: number
          tax_number: string | null
          tax_registered: boolean
          tax_total: number
          tip_total: number
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          barber_name?: string
          client_id?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_reason?: string | null
          discount_total?: number
          id?: string
          is_legacy?: boolean
          note?: string | null
          paid_total?: number
          payment_method?: string | null
          receipt_no?: number | null
          receipt_number?: string | null
          rounding_adjustment?: number
          sale_time?: string
          shop_id: string
          status?: string
          subtotal?: number
          tax_number?: string | null
          tax_registered?: boolean
          tax_total?: number
          tip_total?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          barber_name?: string
          client_id?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_reason?: string | null
          discount_total?: number
          id?: string
          is_legacy?: boolean
          note?: string | null
          paid_total?: number
          payment_method?: string | null
          receipt_no?: number | null
          receipt_number?: string | null
          rounding_adjustment?: number
          sale_time?: string
          shop_id?: string
          status?: string
          subtotal?: number
          tax_number?: string | null
          tax_registered?: boolean
          tax_total?: number
          tip_total?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort: number
          synonyms_ar: string[]
          synonyms_en: string[]
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort?: number
          synonyms_ar?: string[]
          synonyms_en?: string[]
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort?: number
          synonyms_ar?: string[]
          synonyms_en?: string[]
        }
        Relationships: []
      }
      service_variants: {
        Row: {
          created_at: string
          duration: number
          id: string
          is_active: boolean
          name_ar: string | null
          name_en: string
          price: number
          service_id: string
          shop_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration: number
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          price: number
          service_id: string
          shop_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: number
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          price?: number
          service_id?: string
          shop_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_variants_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          audience: string
          buffer_minutes: number
          category_id: string | null
          client_note_ar: string | null
          client_note_en: string | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          duration: number
          icon: string | null
          id: string
          is_active: boolean | null
          location_type: string
          name: string
          name_ar: string | null
          online_bookable: boolean
          price: number
          price_type: string
          processing_minutes: number
          processing_offset_minutes: number
          shop_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          audience?: string
          buffer_minutes?: number
          category_id?: string | null
          client_note_ar?: string | null
          client_note_en?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration: number
          icon?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string
          name: string
          name_ar?: string | null
          online_bookable?: boolean
          price: number
          price_type?: string
          processing_minutes?: number
          processing_offset_minutes?: number
          shop_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          audience?: string
          buffer_minutes?: number
          category_id?: string | null
          client_note_ar?: string | null
          client_note_en?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration?: number
          icon?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string
          name?: string
          name_ar?: string | null
          online_bookable?: boolean
          price?: number
          price_type?: string
          processing_minutes?: number
          processing_offset_minutes?: number
          shop_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_overrides: {
        Row: {
          barber_id: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          note: string | null
          segments: Json
          shop_id: string
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          note?: string | null
          segments?: Json
          shop_id: string
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          note?: string | null
          segments?: Json
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_overrides_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overrides_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_amenities: {
        Row: {
          amenity_id: string
          created_at: string
          shop_id: string
        }
        Insert: {
          amenity_id: string
          created_at?: string
          shop_id: string
        }
        Update: {
          amenity_id?: string
          created_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_amenities_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_photos: {
        Row: {
          alt_ar: string | null
          alt_en: string | null
          blur_data: string | null
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          path: string
          shop_id: string
          sort_order: number
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_ar?: string | null
          alt_en?: string | null
          blur_data?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          path: string
          shop_id: string
          sort_order?: number
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_ar?: string | null
          alt_en?: string | null
          blur_data?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          path?: string
          shop_id?: string
          sort_order?: number
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_photos_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_plan_overrides: {
        Row: {
          created_at: string
          max_barbers: number | null
          monthly_message_allowance: number | null
          note: string | null
          plan_code: string
          shop_id: string
          trial_ends_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          max_barbers?: number | null
          monthly_message_allowance?: number | null
          note?: string | null
          plan_code?: string
          shop_id: string
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          max_barbers?: number | null
          monthly_message_allowance?: number | null
          note?: string | null
          plan_code?: string
          shop_id?: string
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_plan_overrides_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          area_id: string | null
          booking_link_theme: Json
          booking_window_days: number
          cancellation_fee_percent: number | null
          cancellation_policy_hours: number | null
          cash_rounding: number
          city_id: string | null
          cover_url: string | null
          created_at: string | null
          currency: string | null
          daily_goal: number | null
          deposit_type: string | null
          deposit_value: number | null
          description: string | null
          description_ar: string | null
          email: string | null
          google_maps_url: string | null
          id: string
          important_info_ar: string | null
          important_info_en: string | null
          instagram: string | null
          is_published: boolean
          is_tax_registered: boolean
          is_verified: boolean
          landmark_ar: string | null
          landmark_en: string | null
          lat: number | null
          lng: number | null
          logo_url: string | null
          marketplace_visible: boolean
          message_templates: Json
          messaging_channel: string
          messaging_enabled: boolean
          min_notice_minutes: number
          name: string
          name_ar: string | null
          organization_id: string
          phone: string | null
          published_at: string | null
          quiet_hours: Json
          receipt_footer_ar: string | null
          receipt_footer_en: string | null
          receipt_prefix: string | null
          reminder_offsets: number[]
          require_deposit: boolean | null
          review_request_delay_minutes: number
          settings: Json | null
          slot_interval_minutes: number
          slug: string
          slug_ar: string | null
          sms_fallback: boolean
          suspended_at: string | null
          tax_number: string | null
          tax_rate: number
          timezone: string
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          area_id?: string | null
          booking_link_theme?: Json
          booking_window_days?: number
          cancellation_fee_percent?: number | null
          cancellation_policy_hours?: number | null
          cash_rounding?: number
          city_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          currency?: string | null
          daily_goal?: number | null
          deposit_type?: string | null
          deposit_value?: number | null
          description?: string | null
          description_ar?: string | null
          email?: string | null
          google_maps_url?: string | null
          id?: string
          important_info_ar?: string | null
          important_info_en?: string | null
          instagram?: string | null
          is_published?: boolean
          is_tax_registered?: boolean
          is_verified?: boolean
          landmark_ar?: string | null
          landmark_en?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          marketplace_visible?: boolean
          message_templates?: Json
          messaging_channel?: string
          messaging_enabled?: boolean
          min_notice_minutes?: number
          name: string
          name_ar?: string | null
          organization_id: string
          phone?: string | null
          published_at?: string | null
          quiet_hours?: Json
          receipt_footer_ar?: string | null
          receipt_footer_en?: string | null
          receipt_prefix?: string | null
          reminder_offsets?: number[]
          require_deposit?: boolean | null
          review_request_delay_minutes?: number
          settings?: Json | null
          slot_interval_minutes?: number
          slug: string
          slug_ar?: string | null
          sms_fallback?: boolean
          suspended_at?: string | null
          tax_number?: string | null
          tax_rate?: number
          timezone?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          area_id?: string | null
          booking_link_theme?: Json
          booking_window_days?: number
          cancellation_fee_percent?: number | null
          cancellation_policy_hours?: number | null
          cash_rounding?: number
          city_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          currency?: string | null
          daily_goal?: number | null
          deposit_type?: string | null
          deposit_value?: number | null
          description?: string | null
          description_ar?: string | null
          email?: string | null
          google_maps_url?: string | null
          id?: string
          important_info_ar?: string | null
          important_info_en?: string | null
          instagram?: string | null
          is_published?: boolean
          is_tax_registered?: boolean
          is_verified?: boolean
          landmark_ar?: string | null
          landmark_en?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          marketplace_visible?: boolean
          message_templates?: Json
          messaging_channel?: string
          messaging_enabled?: boolean
          min_notice_minutes?: number
          name?: string
          name_ar?: string | null
          organization_id?: string
          phone?: string | null
          published_at?: string | null
          quiet_hours?: Json
          receipt_footer_ar?: string | null
          receipt_footer_en?: string | null
          receipt_prefix?: string | null
          reminder_offsets?: number[]
          require_deposit?: boolean | null
          review_request_delay_minutes?: number
          settings?: Json | null
          slot_interval_minutes?: number
          slug?: string
          slug_ar?: string | null
          sms_fallback?: boolean
          suspended_at?: string | null
          tax_number?: string | null
          tax_rate?: number
          timezone?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_holds: {
        Row: {
          barber_id: string | null
          created_at: string
          end_time: string
          expires_at: string
          id: string
          reason: string
          shop_id: string
          start_time: string
        }
        Insert: {
          barber_id?: string | null
          created_at?: string
          end_time: string
          expires_at: string
          id?: string
          reason?: string
          shop_id: string
          start_time: string
        }
        Update: {
          barber_id?: string | null
          created_at?: string
          end_time?: string
          expires_at?: string
          id?: string
          reason?: string
          shop_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_holds_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      special_hours: {
        Row: {
          created_at: string
          date: string
          id: string
          is_closed: boolean
          note_ar: string | null
          note_en: string | null
          segments: Json
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_closed?: boolean
          note_ar?: string | null
          note_en?: string | null
          segments?: Json
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_closed?: boolean
          note_ar?: string | null
          note_en?: string | null
          segments?: Json
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_push_outbox: {
        Row: {
          appointment_id: string | null
          attempts: number
          claimed_at: string | null
          created_at: string
          error: string | null
          event: string
          finished_at: string | null
          id: string
          payload: Json
          profile_id: string
          result: Json | null
          shop_id: string
          status: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          event: string
          finished_at?: string | null
          id?: string
          payload?: Json
          profile_id: string
          result?: Json | null
          shop_id: string
          status?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          event?: string
          finished_at?: string | null
          id?: string
          payload?: Json
          profile_id?: string
          result?: Json | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_push_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_push_outbox_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_push_outbox_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          barber_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          note: string | null
          shop_id: string
          start_time: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          note?: string | null
          shop_id: string
          start_time: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          note?: string | null
          shop_id?: string
          start_time?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_in_queue: {
        Row: {
          appointment_id: string | null
          assigned_barber_id: string | null
          called_at: string | null
          checked_in_at: string
          client_id: string | null
          client_name: string | null
          created_by: string | null
          finished_at: string | null
          id: string
          note: string | null
          phone: string | null
          preferred_barber_id: string | null
          service_ids: string[]
          shop_id: string
          started_at: string | null
          status: string
          ticket_no: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assigned_barber_id?: string | null
          called_at?: string | null
          checked_in_at?: string
          client_id?: string | null
          client_name?: string | null
          created_by?: string | null
          finished_at?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          preferred_barber_id?: string | null
          service_ids?: string[]
          shop_id: string
          started_at?: string | null
          status?: string
          ticket_no?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assigned_barber_id?: string | null
          called_at?: string | null
          checked_in_at?: string
          client_id?: string | null
          client_name?: string | null
          created_by?: string | null
          finished_at?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          preferred_barber_id?: string | null
          service_ids?: string[]
          shop_id?: string
          started_at?: string | null
          status?: string
          ticket_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_in_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_queue_assigned_barber_id_fkey"
            columns: ["assigned_barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_queue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_queue_preferred_barber_id_fkey"
            columns: ["preferred_barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_queue_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          barber_id: string
          break_end: string | null
          break_start: string | null
          created_at: string | null
          day_of_week: number
          end_time: string | null
          id: string
          is_working: boolean | null
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          barber_id: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week: number
          end_time?: string | null
          id?: string
          is_working?: boolean | null
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          barber_id?: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_working?: boolean | null
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      barber_rating_view: {
        Row: {
          barber_id: string | null
          rating_avg: number | null
          rating_count: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          amount: number | null
          appointment_id: string | null
          barber_name: string | null
          client_name: string | null
          created_at: string | null
          id: string | null
          payment_method: string | null
          sale_time: string | null
          service_name: string | null
          shop_id: string | null
        }
        Insert: {
          amount?: never
          appointment_id?: string | null
          barber_name?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string | null
          payment_method?: never
          sale_time?: string | null
          service_name?: never
          shop_id?: string | null
        }
        Update: {
          amount?: never
          appointment_id?: string | null
          barber_name?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string | null
          payment_method?: never
          sale_time?: string | null
          service_name?: never
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      message_cost_monthly: {
        Row: {
          allowance: number | null
          cost_fils: number | null
          delivered_count: number | null
          failed_count: number | null
          fallback_count: number | null
          marketing_count: number | null
          month: string | null
          pending_count: number | null
          read_count: number | null
          sent_count: number | null
          shop_id: string | null
          sms_count: number | null
          utility_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string }
        Returns: {
          role: string
          shop_id: string
        }[]
      }
      add_sale_payments: {
        Args: { p_payments: Json; p_sale_id: string }
        Returns: Json
      }
      admin_audit: {
        Args: {
          p_action: string
          p_diff?: Json
          p_impersonation_id?: string
          p_reason?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      admin_clamp: {
        Args: {
          p_default: number
          p_max: number
          p_min: number
          p_value: number
        }
        Returns: number
      }
      admin_create_claim_dispute: {
        Args: {
          p_claimant_name: string
          p_claimant_phone: string
          p_details: string
          p_shop_id: string
        }
        Returns: Json
      }
      admin_get_shop: { Args: { p_shop_id: string }; Returns: Json }
      admin_impersonation_set_service_active: {
        Args: { p_active: boolean; p_service_id: string; p_session_id: string }
        Returns: Json
      }
      admin_impersonation_snapshot: {
        Args: { p_session_id: string }
        Returns: Json
      }
      admin_impersonation_update_shop: {
        Args: { p_patch: Json; p_session_id: string }
        Returns: Json
      }
      admin_list_audit: {
        Args: {
          p_action?: string
          p_limit?: number
          p_offset?: number
          p_target_id?: string
          p_target_type?: string
        }
        Returns: Json
      }
      admin_list_bans: { Args: { p_limit?: number }; Returns: Json }
      admin_list_claims: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: Json
      }
      admin_list_review_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: Json
      }
      admin_list_shops: {
        Args: {
          p_city_id?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_live_session: {
        Args: { p_need_write: boolean; p_session_id: string }
        Returns: {
          actor_id: string
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          mode: string
          reason: string | null
          shop_id: string
          started_at: string
        }
        SetofOptions: {
          from: "*"
          to: "admin_impersonation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_overview: { Args: never; Returns: Json }
      admin_phone_key: { Args: { p_phone: string }; Returns: string }
      admin_reason: {
        Args: { p_min?: number; p_reason: string; p_required?: boolean }
        Returns: string
      }
      admin_require: { Args: { p_min?: string }; Returns: string }
      admin_resolve_claim_dispute: {
        Args: { p_decision: string; p_id: string; p_note: string }
        Returns: Json
      }
      admin_resolve_review_report: {
        Args: { p_decision: string; p_note?: string; p_report_id: string }
        Returns: Json
      }
      admin_search_profiles: {
        Args: { p_limit?: number; p_q: string }
        Returns: Json
      }
      admin_set_phone_banned: {
        Args: { p_banned: boolean; p_phone: string; p_reason: string }
        Returns: Json
      }
      admin_set_plan_override: {
        Args: { p_plan: Json; p_reason: string; p_shop_id: string }
        Returns: Json
      }
      admin_set_profile_banned: {
        Args: { p_banned: boolean; p_profile_id: string; p_reason: string }
        Returns: Json
      }
      admin_set_review_hidden: {
        Args: { p_hidden: boolean; p_reason: string; p_review_id: string }
        Returns: Json
      }
      admin_set_shop_suspended: {
        Args: { p_reason: string; p_shop_id: string; p_suspended: boolean }
        Returns: Json
      }
      admin_set_shop_verified: {
        Args: { p_reason?: string; p_shop_id: string; p_verified: boolean }
        Returns: Json
      }
      admin_start_impersonation: {
        Args: { p_mode?: string; p_reason?: string; p_shop_id: string }
        Returns: Json
      }
      admin_stop_impersonation: {
        Args: { p_session_id: string }
        Returns: Json
      }
      admin_whoami: { Args: never; Returns: Json }
      appointment_cart_lines: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      appointment_services_rebuild: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      availability_allowed_ignore: {
        Args: { p_appointment_id: string; p_shop_id: string }
        Returns: string
      }
      availability_engine: {
        Args: {
          p_at: string
          p_barber_id: string
          p_from: string
          p_ignore_appointment_id: string
          p_ignore_hold_id: string
          p_public: boolean
          p_service_ids: string[]
          p_shop_id: string
          p_to: string
        }
        Returns: {
          barber_id: string
          buffer_minutes: number
          end_time: string
          start_time: string
        }[]
      }
      availability_is_staff: { Args: { p_shop_id: string }; Returns: boolean }
      availability_parse_items: {
        Args: { p_items: Json; p_shop_id: string }
        Returns: string[]
      }
      availability_segments_valid: { Args: { p: Json }; Returns: boolean }
      availability_unassigned_load: {
        Args: {
          p_end: string
          p_ignore_appointment_id: string
          p_ignore_hold_id: string
          p_shop_id: string
          p_start: string
        }
        Returns: number
      }
      availability_work_ranges: {
        Args: {
          p_barber_id: string
          p_from: string
          p_shop_id: string
          p_to: string
          p_tz: string
        }
        Returns: unknown
      }
      barber_is_public: { Args: { p_barber_id: string }; Returns: boolean }
      barber_is_working: {
        Args: {
          p_barber_id: string
          p_end: string
          p_start: string
          p_tz: string
        }
        Returns: boolean
      }
      barber_offers_services: {
        Args: { p_barber_id: string; p_service_ids: string[] }
        Returns: boolean
      }
      booking_link_theme_valid: { Args: { p: Json }; Returns: boolean }
      booking_source_category: { Args: { p_src: string }; Returns: string }
      calendar_seed_block_types: {
        Args: { p_shop_id: string }
        Returns: undefined
      }
      can_write_shop_media: { Args: { p_name: string }; Returns: boolean }
      cancel_by_token: {
        Args: { p_reason?: string; p_token: string }
        Returns: Json
      }
      cancel_customer_booking: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_queued_message: { Args: { p_id: string }; Returns: Json }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      check_request_rate_limit: {
        Args: {
          p_max: number
          p_scope: string
          p_subject?: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      checkout_sale: { Args: { p_payload: Json }; Returns: Json }
      claim_customer_identity: { Args: never; Returns: Json }
      complete_appointment_sale: {
        Args: {
          p_amount?: number
          p_appointment_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      confirm_by_token: { Args: { p_token: string }; Returns: Json }
      create_public_booking: {
        Args: {
          p_barber_id: string
          p_captcha_token?: string
          p_client_name: string
          p_client_phone: string
          p_entry?: string
          p_items?: Json
          p_notes?: string
          p_otp_token?: string
          p_service_ids: string[]
          p_shop_id: string
          p_source?: string
          p_start_time: string
        }
        Returns: Json
      }
      create_shop_from_wizard: { Args: { payload: Json }; Returns: Json }
      current_platform_role: { Args: never; Returns: string }
      current_profile_shop_and_role: {
        Args: never
        Returns: {
          role: string
          shop_id: string
        }[]
      }
      customer_attach_verified_phone: {
        Args: { p_method?: string; p_phone: string; p_profile_id: string }
        Returns: Json
      }
      customer_phone_login_resolve: {
        Args: { p_phone: string; p_token: string }
        Returns: Json
      }
      dashboard_metrics: { Args: { p_shop_id: string }; Returns: Json }
      delete_my_account: { Args: { p_confirm: string }; Returns: Json }
      enqueue_message: {
        Args: {
          p_appointment_id?: string
          p_body?: string
          p_channel?: string
          p_dedupe_key?: string
          p_locale?: string
          p_sale_id?: string
          p_scheduled_for?: string
          p_shop_id: string
          p_template: string
          p_to: string
          p_vars?: Json
        }
        Returns: Json
      }
      ensure_default_block_types: { Args: never; Returns: number }
      export_my_data: { Args: never; Returns: Json }
      generate_prayer_blocks: {
        Args: { p_days?: number; p_shop_id?: string }
        Returns: number
      }
      get_available_slots: {
        Args: {
          p_barber_id?: string
          p_date_from: string
          p_date_to: string
          p_ignore_appointment_id?: string
          p_ignore_hold_id?: string
          p_items: Json
          p_shop_id: string
        }
        Returns: {
          barber_ids: string[]
          end_time: string
          local_date: string
          local_time: string
          start_time: string
        }[]
      }
      get_barber_reviews: {
        Args: { p_barber_id: string; p_limit?: number }
        Returns: {
          comment: string
          created_at: string
          id: string
          rating: number
          reviewer_name: string
          service_name: string
          service_name_ar: string
        }[]
      }
      get_book_again: {
        Args: { p_limit?: number }
        Returns: {
          barber_id: string
          barber_name: string
          cover_url: string
          last_visit: string
          service_ids: string[]
          service_name: string
          shop_id: string
          shop_name: string
          shop_name_ar: string
          shop_slug: string
          shop_slug_ar: string
        }[]
      }
      get_booking_by_token: { Args: { p_token: string }; Returns: Json }
      get_busy_slots: {
        Args: { p_barber_id?: string; p_day: string; p_shop_id: string }
        Returns: {
          barber_id: string
          end_time: string
          start_time: string
        }[]
      }
      get_current_organization_id: { Args: never; Returns: string }
      get_current_shop_id: { Args: never; Returns: string }
      get_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          role: string
          shop_id: string
          status: string
        }[]
      }
      get_link_stats: {
        Args: { p_days?: number }
        Returns: {
          bookings: number
          channel: string
          completed: number
          visits: number
        }[]
      }
      get_my_account: { Args: never; Returns: Json }
      get_my_appointments: {
        Args: never
        Returns: {
          barber_id: string
          barber_name: string
          cancellation_policy_hours: number
          cancelled_at: string
          client_name: string
          currency: string
          end_time: string
          has_review: boolean
          id: string
          price: number
          service_ids: string[]
          service_name: string
          shop_address: string
          shop_id: string
          shop_name: string
          shop_phone: string
          shop_timezone: string
          source: string
          start_time: string
          status: string
        }[]
      }
      get_my_shop_private: {
        Args: never
        Returns: {
          daily_goal: number
          settings: Json
          shop_id: string
        }[]
      }
      get_my_shop_tax: {
        Args: never
        Returns: {
          is_tax_registered: boolean
          shop_id: string
          tax_number: string
        }[]
      }
      get_onboarding_state: { Args: never; Returns: Json }
      get_profile_phones: {
        Args: never
        Returns: {
          id: string
          phone: string
        }[]
      }
      get_sale_receipt: { Args: { p_sale_id: string }; Returns: Json }
      get_shop_publish_checklist: { Args: { p_shop_id: string }; Returns: Json }
      get_user_shop_id: { Args: never; Returns: string }
      guess_service_category: {
        Args: { p_name: string; p_name_ar?: string }
        Returns: string
      }
      is_admin_of_profile: { Args: { p_profile_id: string }; Returns: boolean }
      is_admin_of_shop: { Args: { p_shop_id: string }; Returns: boolean }
      is_phone_banned: { Args: { p_phone: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_staff: { Args: never; Returns: boolean }
      is_shop_admin: { Args: never; Returns: boolean }
      is_shop_staff: { Args: never; Returns: boolean }
      is_slot_bookable: {
        Args: {
          p_barber_id?: string
          p_ignore_appointment_id?: string
          p_ignore_hold_id?: string
          p_items: Json
          p_shop_id: string
          p_start: string
        }
        Returns: boolean
      }
      is_staff_of_shop: { Args: { p_shop_id: string }; Returns: boolean }
      link_channel: { Args: { p_src: string }; Returns: string }
      link_customer_client: { Args: never; Returns: string }
      mark_message_sent_manually: { Args: { p_id: string }; Returns: Json }
      mask_phone: { Args: { p: string }; Returns: string }
      message_enqueue_internal: {
        Args: {
          p_appointment_id?: string
          p_body?: string
          p_channel?: string
          p_client_id?: string
          p_created_by?: string
          p_dedupe_key?: string
          p_locale?: string
          p_offset?: number
          p_payload?: Json
          p_sale_id?: string
          p_scheduled_for?: string
          p_shop_id: string
          p_status?: string
          p_template: string
          p_to: string
        }
        Returns: string
      }
      messaging_appointment_context: { Args: { p_appt: string }; Returns: Json }
      messaging_claim: {
        Args: { p_limit?: number; p_live?: boolean }
        Returns: Json
      }
      messaging_complete: {
        Args: {
          p_channel?: string
          p_cost_fils?: number
          p_error?: string
          p_id: string
          p_provider?: string
          p_provider_msg_id?: string
          p_result: string
          p_retry_at?: string
        }
        Returns: string
      }
      messaging_handle_inbound: {
        Args: {
          p_body?: string
          p_button_payload?: string
          p_channel?: string
          p_context_msg_id?: string
          p_from: string
          p_provider_msg_id?: string
        }
        Returns: Json
      }
      messaging_heartbeat: {
        Args: { p_providers: string[]; p_result?: Json }
        Returns: undefined
      }
      messaging_is_service: { Args: never; Returns: boolean }
      messaging_live: { Args: never; Returns: boolean }
      messaging_normalize_phone: { Args: { p: string }; Returns: string }
      messaging_offsets_valid: { Args: { p: number[] }; Returns: boolean }
      messaging_plan_appointment: {
        Args: { p_appt: string; p_event: string; p_old_status?: string }
        Returns: undefined
      }
      messaging_plan_reminders: {
        Args: { p_appt: string; p_ctx: Json }
        Returns: number
      }
      messaging_quiet_until: {
        Args: { p_at: string; p_quiet: Json; p_tz: string }
        Returns: string
      }
      messaging_record_status: {
        Args: {
          p_at?: string
          p_error?: string
          p_provider_msg_id: string
          p_status: string
        }
        Returns: boolean
      }
      messaging_session_open: { Args: { p_phone: string }; Returns: boolean }
      messaging_status: { Args: never; Returns: Json }
      messaging_template_category: { Args: { p: string }; Returns: string }
      messaging_template_deferrable: { Args: { p: string }; Returns: boolean }
      messaging_template_known: { Args: { p: string }; Returns: boolean }
      messaging_template_optional: { Args: { p: string }; Returns: boolean }
      messaging_time: {
        Args: { p: string; p_default: string }
        Returns: string
      }
      messaging_token_guard: {
        Args: { p_token: string; p_write: boolean }
        Returns: undefined
      }
      messaging_token_valid: { Args: { p_token: string }; Returns: boolean }
      my_client_ids: { Args: never; Returns: string[] }
      new_manage_token: { Args: never; Returns: string }
      next_available_slot: {
        Args: {
          p_after?: string
          p_barber_id?: string
          p_items: Json
          p_shop_id: string
        }
        Returns: {
          barber_ids: string[]
          end_time: string
          local_date: string
          local_time: string
          start_time: string
        }[]
      }
      normalize_ar: { Args: { p: string }; Returns: string }
      notify_staff_event: {
        Args: { p_appointment_id: string; p_event: string }
        Returns: number
      }
      onboarding_avatar: { Args: { p_value: string }; Returns: string }
      onboarding_parse_time: {
        Args: { p_field: string; p_value: string }
        Returns: string
      }
      onboarding_shop_eligible: {
        Args: { p_shop_id: string }
        Returns: boolean
      }
      onboarding_text: {
        Args: { p_max: number; p_value: string }
        Returns: string
      }
      otp_issue: {
        Args: { p_phone: string; p_ttl_seconds?: number }
        Returns: Json
      }
      otp_phone_key: { Args: { p_phone: string }; Returns: string }
      otp_verify: { Args: { p_code: string; p_phone: string }; Returns: Json }
      pick_any_barber: {
        Args: {
          p_ignore_appointment_id?: string
          p_ignore_hold_id?: string
          p_items: Json
          p_shop_id: string
          p_start: string
        }
        Returns: string
      }
      pos_checkout: {
        Args: { p_internal?: boolean; p_payload: Json }
        Returns: Json
      }
      pos_discount_amount: {
        Args: { p_base: number; p_spec: Json }
        Returns: number
      }
      pos_require_staff: {
        Args: { p_shop_id: string }
        Returns: {
          auto_assignable: boolean
          avatar_url: string | null
          banned_at: string | null
          bio_ar: string | null
          bio_en: string | null
          calendar_color: string | null
          calendar_order: number | null
          created_at: string | null
          digit_preference: string
          full_name: string
          handle: string | null
          id: string
          is_public: boolean
          languages: string[]
          marketing_opt_in: boolean
          notify_channel: string
          notify_reminders: boolean
          online_bookable: boolean
          phone: string | null
          platform_role: string | null
          preferred_language: string | null
          role: string
          shop_id: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string | null
          years_experience: number | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prayer_city_for_shop: { Args: { p_shop_id: string }; Returns: string }
      prayer_compute_times: {
        Args: {
          p_asr_factor?: number
          p_date: string
          p_dhuhr_offset_min?: number
          p_fajr_angle?: number
          p_isha_angle?: number
          p_lat: number
          p_lng: number
          p_maghrib_offset_min?: number
          p_sunrise_offset_min?: number
        }
        Returns: {
          asr: string
          dhuhr: string
          fajr: string
          isha: string
          maghrib: string
          sunrise: string
        }[]
      }
      prayer_fill_cache: {
        Args: { p_city_id: string; p_from: string; p_to: string }
        Returns: number
      }
      prayer_sun_position: {
        Args: { p_jd: number }
        Returns: Record<string, unknown>
      }
      privacy_is_synthetic_email: {
        Args: { p_email: string }
        Returns: boolean
      }
      privacy_link_clients: {
        Args: { p_method?: string; p_profile_id: string }
        Returns: number
      }
      privacy_my_phone_keys: {
        Args: { p_clients: string[]; p_profile_id: string }
        Returns: string[]
      }
      privacy_outbox_where: { Args: never; Returns: string }
      privacy_phone_key: { Args: { p_phone: string }; Returns: string }
      privacy_store_verified_phone: {
        Args: { p_method: string; p_phone: string; p_profile_id: string }
        Returns: string
      }
      profile_unique_handle: {
        Args: { p_base: string; p_profile_id: string }
        Returns: string
      }
      public_recent_reviews: {
        Args: { p_city_id?: string; p_limit?: number }
        Returns: {
          area_name_ar: string
          area_name_en: string
          comment: string
          created_at: string
          id: string
          rating: number
          reviewer: string
          shop_id: string
          shop_name: string
          shop_name_ar: string
          shop_slug: string
          shop_slug_ar: string
        }[]
      }
      public_stats: { Args: { p_city_id?: string }; Returns: Json }
      push_claim_jobs: { Args: { p_limit?: number }; Returns: Json }
      push_complete_jobs: { Args: { p_results: Json }; Returns: number }
      push_send_test: { Args: { p_locale?: string }; Returns: string }
      push_subscribe: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_locale?: string
          p_old_endpoint?: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
      push_unsubscribe: { Args: { p_endpoint: string }; Returns: boolean }
      queue_assign: {
        Args: { p_barber_id?: string; p_entry_id: string }
        Returns: Json
      }
      record_consent: {
        Args: {
          p_channel?: string
          p_granted: boolean
          p_policy_version?: string
          p_purpose: string
          p_source?: string
        }
        Returns: string
      }
      record_link_visit: {
        Args: { p_entry?: string; p_shop_id: string; p_src?: string }
        Returns: boolean
      }
      report_review: {
        Args: { p_details?: string; p_reason: string; p_review_id: string }
        Returns: string
      }
      request_ip: { Args: never; Returns: string }
      reschedule_booking: {
        Args: {
          p_barber_id?: string
          p_date: string
          p_id: string
          p_start: string
        }
        Returns: Json
      }
      reschedule_by_token: {
        Args: {
          p_barber_id?: string
          p_date: string
          p_start: string
          p_token: string
        }
        Returns: Json
      }
      sale_receipt_json: { Args: { p_sale_id: string }; Returns: Json }
      save_calendar_team: { Args: { p_items: Json }; Returns: number }
      save_onboarding_progress: {
        Args: { p_data: Json; p_step: string }
        Returns: string
      }
      search_barbers: {
        Args: {
          p_area_id?: string
          p_city_id?: string
          p_date?: string
          p_filters?: Json
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_offset?: number
          p_q?: string
          p_radius_km?: number
          p_sort?: string
          p_time_from?: string
          p_time_to?: string
        }
        Returns: {
          area_name_ar: string
          area_name_en: string
          avatar_url: string
          city_name_ar: string
          city_name_en: string
          currency: string
          distance_km: number
          full_name: string
          handle: string
          id: string
          languages: string[]
          lat: number
          lng: number
          matched_services: Json
          min_price: number
          next_slot_local_date: string
          next_slot_local_time: string
          next_slot_start: string
          rating_avg: number
          rating_count: number
          score: number
          shop_id: string
          shop_is_verified: boolean
          shop_name: string
          shop_name_ar: string
          shop_slug: string
          shop_slug_ar: string
          title_ar: string
          title_en: string
          total_count: number
          years_experience: number
        }[]
      }
      search_distance_km: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      search_normalize: { Args: { p: string }; Returns: string }
      search_open_until: {
        Args: { p_shop_id: string; p_tz?: string }
        Returns: string
      }
      search_rate_ok: { Args: { p_scope?: string }; Returns: boolean }
      search_service_hits: {
        Args: { p_shop_ids: string[]; p_terms: string[] }
        Returns: {
          service_id: string
          shop_id: string
          term: string
        }[]
      }
      search_shop_base: {
        Args: {
          p_area_id: string
          p_city_id: string
          p_filters: Json
          p_lat: number
          p_lng: number
          p_radius_km: number
        }
        Returns: {
          distance_km: number
          has_card: boolean
          has_cliq: boolean
          has_home: boolean
          has_kids: boolean
          has_parking: boolean
          shop_id: string
          works_today: boolean
        }[]
      }
      search_shops: {
        Args: {
          p_area_id?: string
          p_city_id?: string
          p_date?: string
          p_filters?: Json
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_offset?: number
          p_q?: string
          p_radius_km?: number
          p_sort?: string
          p_time_from?: string
          p_time_to?: string
        }
        Returns: {
          area_name_ar: string
          area_name_en: string
          badges: string[]
          city_name_ar: string
          city_name_en: string
          cover_url: string
          currency: string
          distance_km: number
          id: string
          is_verified: boolean
          lat: number
          lng: number
          logo_url: string
          matched_services: Json
          min_price: number
          name: string
          name_ar: string
          next_slot_local_date: string
          next_slot_local_time: string
          next_slot_start: string
          open_now: boolean
          open_until: string
          rating_avg: number
          rating_count: number
          score: number
          services_count: number
          slug: string
          slug_ar: string
          total_count: number
        }[]
      }
      search_terms: { Args: { p_q: string }; Returns: string[] }
      seed_default_payment_methods: {
        Args: { p_shop_id: string }
        Returns: undefined
      }
      seed_staff_defaults: {
        Args: { p_profile_id: string; p_shop_id: string }
        Returns: undefined
      }
      set_push_dispatch_config: {
        Args: { p_secret: string; p_url: string }
        Returns: undefined
      }
      shop_daily_goal: { Args: { p_shop_id: string }; Returns: number }
      shop_is_public: { Args: { p_shop_id: string }; Returns: boolean }
      shop_publish_checklist_internal: {
        Args: { p_shop_id: string }
        Returns: Json
      }
      shop_publish_missing: { Args: { p_shop_id: string }; Returns: string[] }
      shop_publish_missing_internal: {
        Args: { p_shop_id: string }
        Returns: string[]
      }
      shop_unique_slug: {
        Args: { p_arabic?: boolean; p_base: string; p_shop_id: string }
        Returns: string
      }
      slugify_ar: { Args: { p: string }; Returns: string }
      slugify_latin: { Args: { p: string }; Returns: string }
      staff_pref_enabled: {
        Args: { p_channel: string; p_event: string; p_profile_id: string }
        Returns: boolean
      }
      staff_push_enqueue: {
        Args: {
          p_appt: Database["public"]["Tables"]["appointments"]["Row"]
          p_event: string
          p_extra?: Json
          p_recipient?: string
        }
        Returns: number
      }
      staff_push_events: { Args: never; Returns: string[] }
      submit_review: {
        Args: { p_appointment_id: string; p_comment?: string; p_rating: number }
        Returns: string
      }
      undo_no_show: { Args: { p_appointment_id: string }; Returns: Json }
      update_messaging_settings: { Args: { p_settings: Json }; Returns: Json }
      update_my_account: {
        Args: { p_patch: Json; p_source?: string }
        Returns: Json
      }
      verified_identity: {
        Args: { p_uid: string }
        Returns: {
          email: string
          phone_digits: string
        }[]
      }
      void_sale: {
        Args: { p_reason: string; p_refund?: boolean; p_sale_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


// ─── Convenience aliases (hand-written; keep when regenerating) ───
type PublicSchema = Database["public"];
type GeneratedArgs<F extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][F]["Args"];
/** RPC arguments; NULL is accepted for every argument (SQL functions treat it as "not given"). */
export type RpcArgs<F extends keyof PublicSchema["Functions"]> = {
  [K in keyof GeneratedArgs<F>]: GeneratedArgs<F>[K] | null;
};
/** jsonb-returning RPCs, typed by their documented object shape. */
interface RpcReturnOverrides {
  create_public_booking: BookingResult;
  cancel_customer_booking: CancelBookingResult;
  complete_appointment_sale: CompleteSaleResult;
  dashboard_metrics: DashboardMetrics | null;
}
export type RpcReturns<F extends keyof PublicSchema["Functions"]> = F extends keyof RpcReturnOverrides
  ? RpcReturnOverrides[F]
  : PublicSchema["Functions"][F]["Returns"];
/** get_busy_slots row — an occupied interval (active statuses; public callers also get closures, blocks, holds). */
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
