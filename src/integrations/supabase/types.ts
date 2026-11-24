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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_deletion_jobs: {
        Row: {
          lease_until: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          lease_until?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          lease_until?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_advice_history: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_requests: {
        Row: {
          answer: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          month: string
          request_hash: string
          request_id: string
          status: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          month: string
          request_hash: string
          request_id: string
          status?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          month?: string
          request_hash?: string
          request_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_categories: {
        Row: {
          created_at: string
          group_key: string
          id: string
          key: string
          name: string
          sort_order: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_key: string
          id?: string
          key: string
          name: string
          sort_order?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_key?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
          user_id?: string | null
        }
        Relationships: []
      }
      asset_history: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          month: string
          recorded_on: string | null
          source: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          month: string
          recorded_on?: string | null
          source?: string
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          month?: string
          recorded_on?: string | null
          source?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          amount: number
          avg_cost: number | null
          category_id: string
          created_at: string
          current_price: number | null
          id: string
          memo: string | null
          name: string
          quantity: number | null
          ticker: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          avg_cost?: number | null
          category_id: string
          created_at?: string
          current_price?: number | null
          id?: string
          memo?: string | null
          name: string
          quantity?: number | null
          ticker?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          avg_cost?: number | null
          category_id?: string
          created_at?: string
          current_price?: number | null
          id?: string
          memo?: string | null
          name?: string
          quantity?: number | null
          ticker?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          deadline: string
          expected_return: number
          id: string
          monthly_contribution: number
          name: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline: string
          expected_return?: number
          id?: string
          monthly_contribution?: number
          name: string
          target_amount: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deadline?: string
          expected_return?: number
          id?: string
          monthly_contribution?: number
          name?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      income_expenses: {
        Row: {
          created_at: string
          fixed_cost: number
          id: string
          income: number
          investment: number
          month: string
          savings: number
          user_id: string
          variable_cost: number
        }
        Insert: {
          created_at?: string
          fixed_cost?: number
          id?: string
          income?: number
          investment?: number
          month: string
          savings?: number
          user_id?: string
          variable_cost?: number
        }
        Update: {
          created_at?: string
          fixed_cost?: number
          id?: string
          income?: number
          investment?: number
          month?: string
          savings?: number
          user_id?: string
          variable_cost?: number
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          attempts: number
          environment: string
          error_code: string | null
          event_created: number
          event_id: string
          event_type: string
          processed_at: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          attempts?: number
          environment: string
          error_code?: string | null
          event_created: number
          event_id: string
          event_type: string
          processed_at?: string
          status: string
          subscription_id?: string | null
        }
        Update: {
          attempts?: number
          environment?: string
          error_code?: string | null
          event_created?: number
          event_id?: string
          event_type?: string
          processed_at?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          display_name: string | null
          id: string
          monthly_expense: number | null
          monthly_income: number | null
          monthly_investment: number | null
          notify_goal: boolean
          notify_reminder: boolean
          region: string | null
          risk_tolerance: string | null
          updated_at: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          id: string
          monthly_expense?: number | null
          monthly_income?: number | null
          monthly_investment?: number | null
          notify_goal?: boolean
          notify_reminder?: boolean
          region?: string | null
          risk_tolerance?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          monthly_expense?: number | null
          monthly_income?: number | null
          monthly_investment?: number | null
          notify_goal?: boolean
          notify_reminder?: boolean
          region?: string | null
          risk_tolerance?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          last_synced_at: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          price_id: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_synced_at?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          price_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_synced_at?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          price_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment_event: {
        Args: {
          p_cancel: boolean
          p_customer_id: string
          p_environment: string
          p_event_created: number
          p_event_id: string
          p_event_type: string
          p_fetched_at: string
          p_period_end: string
          p_period_start: string
          p_price_id: string
          p_status: string
          p_subscription_id: string
          p_user_id: string
        }
        Returns: string
      }
      claim_account_deletion: { Args: { p_user_id: string }; Returns: boolean }
      create_goal_for_environment: {
        Args: {
          p_deadline: string
          p_environment: string
          p_monthly: number
          p_name: string
          p_rate: number
          p_target: number
          p_user_id: string
        }
        Returns: string
      }
      ensure_current_month_asset_history:
        | { Args: never; Returns: number }
        | { Args: { p_user_id: string }; Returns: number }
      finish_ai_request: {
        Args: {
          p_answer: string
          p_error: string
          p_question: string
          p_request_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_payment_failure: {
        Args: {
          p_environment: string
          p_event_created: number
          p_event_id: string
          p_event_type: string
        }
        Returns: undefined
      }
      reserve_ai_request: {
        Args: {
          p_limit: number
          p_request_hash: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      plan_tier: "free" | "premium"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      plan_tier: ["free", "premium"],
    },
  },
} as const
