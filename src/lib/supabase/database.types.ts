export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            appointments: {
                Row: {
                    id: string
                    shop_id: string
                    client_id: string | null
                    barber_id: string | null
                    service_ids: string[] | null
                    client_name: string
                    start_time: string
                    end_time: string
                    status: string | null
                    price: number
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    shop_id: string
                    client_id?: string | null
                    barber_id?: string | null
                    service_ids?: string[] | null
                    client_name: string
                    start_time: string
                    end_time: string
                    status?: string | null
                    price: number
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    shop_id?: string
                    client_id?: string | null
                    barber_id?: string | null
                    service_ids?: string[] | null
                    client_name?: string
                    start_time?: string
                    end_time?: string
                    status?: string | null
                    price?: number
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            clients: {
                Row: {
                    id: string
                    shop_id: string
                    name: string
                    phone: string | null
                    email: string | null
                    notes: string | null
                    total_spend: number | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    shop_id: string
                    name: string
                    phone?: string | null
                    email?: string | null
                    notes?: string | null
                    total_spend?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    shop_id?: string
                    name?: string
                    phone?: string | null
                    email?: string | null
                    notes?: string | null
                    total_spend?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            leads: {
                Row: {
                    id: string
                    shop_id: string
                    client_id: string | null
                    name: string
                    contact: string | null
                    stage: 'new' | 'contacted' | 'booked' | 'completed' | 'regular'
                    value: number | null
                    notes: string | null
                    position: number | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    shop_id: string
                    client_id?: string | null
                    name: string
                    contact?: string | null
                    stage?: 'new' | 'contacted' | 'booked' | 'completed' | 'regular'
                    value?: number | null
                    notes?: string | null
                    position?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    shop_id?: string
                    client_id?: string | null
                    name?: string
                    contact?: string | null
                    stage?: 'new' | 'contacted' | 'booked' | 'completed' | 'regular'
                    value?: number | null
                    notes?: string | null
                    position?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            profiles: {
                Row: {
                    id: string
                    shop_id: string
                    role: 'shop_admin' | 'barber'
                    full_name: string
                    avatar_url: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    shop_id: string
                    role?: 'shop_admin' | 'barber'
                    full_name: string
                    avatar_url?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    shop_id?: string
                    role?: 'shop_admin' | 'barber'
                    full_name?: string
                    avatar_url?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            services: {
                Row: {
                    id: string
                    shop_id: string
                    name: string
                    name_ar: string | null
                    duration: number
                    price: number
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    shop_id: string
                    name: string
                    name_ar?: string | null
                    duration: number
                    price: number
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    shop_id?: string
                    name?: string
                    name_ar?: string | null
                    duration?: number
                    price?: number
                    created_at?: string | null
                }
            }
            shops: {
                Row: {
                    id: string
                    name: string
                    address: string | null
                    currency: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    address?: string | null
                    currency?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    address?: string | null
                    currency?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
        }
    }
}
