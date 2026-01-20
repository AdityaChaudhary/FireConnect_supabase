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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      connections: {
        Row: {
          created_at: string | null
          id: string
          recipient_id: string
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipient_id: string
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recipient_id?: string
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string | null
          id: string
          media_url: string | null
          sender_id: string
          text: string | null
          thread_id: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_url?: string | null
          sender_id: string
          text?: string | null
          thread_id: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          media_url?: string | null
          sender_id?: string
          text?: string | null
          thread_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_check: {
        Row: {
          last_checked_at: string | null
          user_id: string
        }
        Insert: {
          last_checked_at?: string | null
          user_id: string
        }
        Update: {
          last_checked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_check_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_images: {
        Row: {
          blurred_url: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_profile: boolean | null
          url: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          blurred_url?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_profile?: boolean | null
          url: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          blurred_url?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_profile?: boolean | null
          url?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spied_profiles: {
        Row: {
          created_at: string | null
          id: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spied_profiles_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spied_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          media_url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          media_url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          media_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string | null
          id: string
          last_message: string | null
          last_message_time: string | null
          last_read: Json | null
          participants: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          last_message?: string | null
          last_message_time?: string | null
          last_read?: Json | null
          participants: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          last_read?: Json | null
          participants?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      user_online_status: {
        Row: {
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_online_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          gender: string | null
          id: string
          interests: string[] | null
          is_onboarded: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          profile_picture_url: string | null
          spy_credits: number | null
          stripe_customer_id: string | null
          stripe_role: string | null
          updated_at: string | null
          user_type: string | null
          username: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          gender?: string | null
          id: string
          interests?: string[] | null
          is_onboarded?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          profile_picture_url?: string | null
          spy_credits?: number | null
          stripe_customer_id?: string | null
          stripe_role?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          is_onboarded?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          profile_picture_url?: string | null
          spy_credits?: number | null
          stripe_customer_id?: string | null
          stripe_role?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_plans: {
        Args: Record<PropertyKey, never>
        Returns: {
          product_id: string
          name: string
          description: string
          prices: Json
        }[]
      }
      get_subscription_info: {
        Args: {
          p_user_id: string
        }
        Returns: {
          stripe_customer_id: string
          active_subscription: Json
        }[]
      }
    }
    Enums: {
      connection_status: "PENDING" | "CONNECTED" | "DECLINED"
      gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
      subscription_level: "FREE" | "PRO" | "MAX"
      user_type: "HUMAN" | "AI"
      visibility: "PUBLIC" | "PRIVATE" | "CONNECTIONS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never) |
        keyof (Database[PublicTableNameOrOptions["schema"]] extends { Views: any }
          ? Database[PublicTableNameOrOptions["schema"]]["Views"]
          : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
      ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
      : never) &
    (Database[PublicTableNameOrOptions["schema"]] extends { Views: any }
      ? Database[PublicTableNameOrOptions["schema"]]["Views"]
      : never) extends {
      [key in TableName]: {
        Row: infer R
      }
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
      }
      ? I
      : never
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
      }
      ? U
      : never
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: any }
        ? Database[PublicEnumNameOrOptions["schema"]]["Enums"]
        : never)
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]] extends { Enums: any }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : never
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[PublicCompositeTypeNameOrOptions["schema"]] extends {
        CompositeTypes: any
      }
        ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never)
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]] extends {
      CompositeTypes: any
    }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : never
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
