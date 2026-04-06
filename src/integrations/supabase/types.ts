export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          slack_webhook_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedule_entries: {
        Row: {
          id: string
          is_band: boolean
          label: string
          show_id: string
          sort_order: number
          time: string
        }
        Insert: {
          id?: string
          is_band?: boolean
          label: string
          show_id: string
          sort_order?: number
          time: string
        }
        Update: {
          id?: string
          is_band?: boolean
          label?: string
          show_id?: string
          sort_order?: number
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_party_members: {
        Row: {
          id: string
          member_id: string
          show_id: string
        }
        Insert: {
          id?: string
          member_id: string
          show_id: string
        }
        Update: {
          id?: string
          member_id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_party_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "touring_party_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_party_members_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          additional_info: string | null
          age_restriction: string | null
          artist_comps: string | null
          backend_deal: string | null
          backline_provided: string | null
          catering_details: string | null
          changeover_time: string | null
          city: string
          created_at: string
          curfew: string | null
          date: string
          departure_location: string | null
          departure_time: string | null
          dos_contact_name: string | null
          dos_contact_phone: string | null
          green_room_info: string | null
          guarantee: string | null
          guest_list_details: string | null
          hospitality: string | null
          hotel_address: string | null
          hotel_checkin: string | null
          hotel_checkout: string | null
          hotel_confirmation: string | null
          hotel_name: string | null
          id: string
          is_reviewed: boolean
          load_in_details: string | null
          merch_split: string | null
          net_gross: string | null
          parking_notes: string | null
          set_length: string | null
          settlement_guarantee: string | null
          settlement_method: string | null
          support_act: string | null
          support_pay: string | null
          ticket_price: string | null
          tour_id: string | null
          travel_notes: string | null
          updated_at: string
          venue_address: string | null
          venue_capacity: string | null
          venue_name: string
          walkout_potential: string | null
          wifi_network: string | null
          wifi_password: string | null
        }
        Insert: {
          additional_info?: string | null
          age_restriction?: string | null
          artist_comps?: string | null
          backend_deal?: string | null
          backline_provided?: string | null
          catering_details?: string | null
          changeover_time?: string | null
          city: string
          created_at?: string
          curfew?: string | null
          date: string
          departure_location?: string | null
          departure_time?: string | null
          dos_contact_name?: string | null
          dos_contact_phone?: string | null
          green_room_info?: string | null
          guarantee?: string | null
          guest_list_details?: string | null
          hospitality?: string | null
          hotel_address?: string | null
          hotel_checkin?: string | null
          hotel_checkout?: string | null
          hotel_confirmation?: string | null
          hotel_name?: string | null
          id?: string
          is_reviewed?: boolean
          load_in_details?: string | null
          merch_split?: string | null
          net_gross?: string | null
          parking_notes?: string | null
          set_length?: string | null
          settlement_guarantee?: string | null
          settlement_method?: string | null
          support_act?: string | null
          support_pay?: string | null
          ticket_price?: string | null
          tour_id?: string | null
          travel_notes?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_capacity?: string | null
          venue_name: string
          walkout_potential?: string | null
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Update: {
          additional_info?: string | null
          age_restriction?: string | null
          artist_comps?: string | null
          backend_deal?: string | null
          backline_provided?: string | null
          catering_details?: string | null
          changeover_time?: string | null
          city?: string
          created_at?: string
          curfew?: string | null
          date?: string
          departure_location?: string | null
          departure_time?: string | null
          dos_contact_name?: string | null
          dos_contact_phone?: string | null
          green_room_info?: string | null
          guarantee?: string | null
          guest_list_details?: string | null
          hospitality?: string | null
          hotel_address?: string | null
          hotel_checkin?: string | null
          hotel_checkout?: string | null
          hotel_confirmation?: string | null
          hotel_name?: string | null
          id?: string
          is_reviewed?: boolean
          load_in_details?: string | null
          merch_split?: string | null
          net_gross?: string | null
          parking_notes?: string | null
          set_length?: string | null
          settlement_guarantee?: string | null
          settlement_method?: string | null
          support_act?: string | null
          support_pay?: string | null
          ticket_price?: string | null
          tour_id?: string | null
          travel_notes?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_capacity?: string | null
          venue_name?: string
          walkout_potential?: string | null
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      touring_party_members: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      tours: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
