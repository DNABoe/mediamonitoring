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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          context_items: string[] | null
          created_at: string | null
          id: string
          matched_entities: Json | null
          matched_text: string | null
          severity: string | null
          status: string | null
          type: string
        }
        Insert: {
          context_items?: string[] | null
          created_at?: string | null
          id?: string
          matched_entities?: Json | null
          matched_text?: string | null
          severity?: string | null
          status?: string | null
          type: string
        }
        Update: {
          context_items?: string[] | null
          created_at?: string | null
          id?: string
          matched_entities?: Json | null
          matched_text?: string | null
          severity?: string | null
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          created_at: string | null
          engagement: Json | null
          entities: Json | null
          fetched_at: string | null
          fighter_tags: string[] | null
          fulltext_en: string | null
          fulltext_pt: string | null
          id: string
          politics_tags: string[] | null
          published_at: string | null
          sentiment: number | null
          source_id: string | null
          stance: Json | null
          summary_en: string | null
          title_en: string | null
          title_pt: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          engagement?: Json | null
          entities?: Json | null
          fetched_at?: string | null
          fighter_tags?: string[] | null
          fulltext_en?: string | null
          fulltext_pt?: string | null
          id?: string
          politics_tags?: string[] | null
          published_at?: string | null
          sentiment?: number | null
          source_id?: string | null
          stance?: Json | null
          summary_en?: string | null
          title_en?: string | null
          title_pt?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          engagement?: Json | null
          entities?: Json | null
          fetched_at?: string | null
          fighter_tags?: string[] | null
          fulltext_en?: string | null
          fulltext_pt?: string | null
          id?: string
          politics_tags?: string[] | null
          published_at?: string | null
          sentiment?: number | null
          source_id?: string | null
          stance?: Json | null
          summary_en?: string | null
          title_en?: string | null
          title_pt?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          avg_sentiment: number | null
          created_at: string | null
          day: string
          fighter: string
          hotness: number | null
          id: string
          mentions: number | null
          momentum: number | null
        }
        Insert: {
          avg_sentiment?: number | null
          created_at?: string | null
          day: string
          fighter: string
          hotness?: number | null
          id?: string
          mentions?: number | null
          momentum?: number | null
        }
        Update: {
          avg_sentiment?: number | null
          created_at?: string | null
          day?: string
          fighter?: string
          hotness?: number | null
          id?: string
          mentions?: number | null
          momentum?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          components: Json | null
          created_at: string | null
          fighter: string
          hotness: number | null
          id: string
          item_id: string | null
        }
        Insert: {
          components?: Json | null
          created_at?: string | null
          fighter: string
          hotness?: number | null
          id?: string
          item_id?: string | null
        }
        Update: {
          components?: Json | null
          created_at?: string | null
          fighter?: string
          hotness?: number | null
          id?: string
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      sources: {
        Row: {
          country: string | null
          created_at: string | null
          credibility_tier: number | null
          enabled: boolean | null
          id: string
          name: string
          type: string
          updated_at: string | null
          url: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          credibility_tier?: number | null
          enabled?: boolean | null
          id?: string
          name: string
          type: string
          updated_at?: string | null
          url: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
          credibility_tier?: number | null
          enabled?: boolean | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_with_roles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_admin: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_admin?: never
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_admin?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
