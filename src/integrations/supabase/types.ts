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
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      agent_status: {
        Row: {
          active_competitors: string[]
          active_country: string
          articles_collected_total: number | null
          created_at: string | null
          id: string
          last_error: string | null
          last_run_at: string | null
          next_run_at: string | null
          outlets_discovered: number | null
          status: string
          update_frequency: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_competitors?: string[]
          active_country: string
          articles_collected_total?: number | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          next_run_at?: string | null
          outlets_discovered?: number | null
          status?: string
          update_frequency?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_competitors?: string[]
          active_country?: string
          articles_collected_total?: number | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          next_run_at?: string | null
          outlets_discovered?: number | null
          status?: string
          update_frequency?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      article_comments: {
        Row: {
          article_id: string | null
          author_name: string | null
          comment_id: string | null
          content: string
          created_at: string | null
          fetched_at: string | null
          fighter_tags: string[] | null
          id: string
          published_at: string | null
          sentiment: number | null
          user_id: string
        }
        Insert: {
          article_id?: string | null
          author_name?: string | null
          comment_id?: string | null
          content: string
          created_at?: string | null
          fetched_at?: string | null
          fighter_tags?: string[] | null
          id?: string
          published_at?: string | null
          sentiment?: number | null
          user_id: string
        }
        Update: {
          article_id?: string | null
          author_name?: string | null
          comment_id?: string | null
          content?: string
          created_at?: string | null
          fetched_at?: string | null
          fighter_tags?: string[] | null
          id?: string
          published_at?: string | null
          sentiment?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      baselines: {
        Row: {
          alerts_count: number | null
          created_at: string | null
          created_by: string
          data: Json | null
          end_date: string
          id: string
          items_count: number | null
          metrics_summary: Json | null
          start_date: string
          status: string | null
          tracking_country: string
        }
        Insert: {
          alerts_count?: number | null
          created_at?: string | null
          created_by: string
          data?: Json | null
          end_date: string
          id?: string
          items_count?: number | null
          metrics_summary?: Json | null
          start_date: string
          status?: string | null
          tracking_country?: string
        }
        Update: {
          alerts_count?: number | null
          created_at?: string | null
          created_by?: string
          data?: Json | null
          end_date?: string
          id?: string
          items_count?: number | null
          metrics_summary?: Json | null
          start_date?: string
          status?: string | null
          tracking_country?: string
        }
        Relationships: []
      }
      comparison_metrics: {
        Row: {
          country: string | null
          created_at: string
          dimension_scores: Json
          fighter: string
          id: string
          media_reach_score: number
          mentions_count: number
          metric_date: string
          political_support_score: number
          sentiment_score: number
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          dimension_scores?: Json
          fighter: string
          id?: string
          media_reach_score?: number
          mentions_count?: number
          metric_date?: string
          political_support_score?: number
          sentiment_score?: number
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          dimension_scores?: Json
          fighter?: string
          id?: string
          media_reach_score?: number
          mentions_count?: number
          metric_date?: string
          political_support_score?: number
          sentiment_score?: number
          user_id?: string | null
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
          source_country: string | null
          source_id: string | null
          stance: Json | null
          summary_en: string | null
          title_en: string | null
          title_pt: string | null
          tracking_country: string
          url: string
          user_id: string
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
          source_country?: string | null
          source_id?: string | null
          stance?: Json | null
          summary_en?: string | null
          title_en?: string | null
          title_pt?: string | null
          tracking_country?: string
          url: string
          user_id: string
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
          source_country?: string | null
          source_id?: string | null
          stance?: Json | null
          summary_en?: string | null
          title_en?: string | null
          title_pt?: string | null
          tracking_country?: string
          url?: string
          user_id?: string
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
      research_reports: {
        Row: {
          capability_analysis: string | null
          competitors: string[] | null
          cost_analysis: string | null
          country: string | null
          created_at: string
          executive_summary: string
          geopolitical_analysis: string | null
          id: string
          industrial_cooperation: string | null
          media_presence: Json
          media_tonality: Json
          political_analysis: string | null
          report_date: string
          sources: Json
          status: string
          user_id: string | null
        }
        Insert: {
          capability_analysis?: string | null
          competitors?: string[] | null
          cost_analysis?: string | null
          country?: string | null
          created_at?: string
          executive_summary: string
          geopolitical_analysis?: string | null
          id?: string
          industrial_cooperation?: string | null
          media_presence?: Json
          media_tonality?: Json
          political_analysis?: string | null
          report_date?: string
          sources?: Json
          status?: string
          user_id?: string | null
        }
        Update: {
          capability_analysis?: string | null
          competitors?: string[] | null
          cost_analysis?: string | null
          country?: string | null
          created_at?: string
          executive_summary?: string
          geopolitical_analysis?: string | null
          id?: string
          industrial_cooperation?: string | null
          media_presence?: Json
          media_tonality?: Json
          political_analysis?: string | null
          report_date?: string
          sources?: Json
          status?: string
          user_id?: string | null
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
      social_media_posts: {
        Row: {
          author_name: string | null
          author_username: string | null
          content: string
          created_at: string | null
          engagement: Json | null
          fetched_at: string | null
          fighter_tags: string[] | null
          id: string
          platform: string
          post_id: string
          post_url: string
          published_at: string
          sentiment: number | null
          tracking_country: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          author_username?: string | null
          content: string
          created_at?: string | null
          engagement?: Json | null
          fetched_at?: string | null
          fighter_tags?: string[] | null
          id?: string
          platform: string
          post_id: string
          post_url: string
          published_at: string
          sentiment?: number | null
          tracking_country?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          author_username?: string | null
          content?: string
          created_at?: string | null
          engagement?: Json | null
          fetched_at?: string | null
          fighter_tags?: string[] | null
          id?: string
          platform?: string
          post_id?: string
          post_url?: string
          published_at?: string
          sentiment?: number | null
          tracking_country?: string
          user_id?: string
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
      user_settings: {
        Row: {
          active_competitors: string[]
          active_country: string
          created_at: string | null
          id: string
          prioritized_outlets: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_competitors?: string[]
          active_country?: string
          created_at?: string | null
          id?: string
          prioritized_outlets?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_competitors?: string[]
          active_country?: string
          created_at?: string | null
          id?: string
          prioritized_outlets?: Json | null
          updated_at?: string | null
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
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_admin?: never
          role?: never
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_admin?: never
          role?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_country_data: {
        Args: { _old_country: string; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      stop_agent_and_cleanup: {
        Args: { _country: string; _user_id: string }
        Returns: undefined
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
