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
      favorites: {
        Row: {
          created_at: string
          household_id: string
          id: string
          profile_id: string
          recipe_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          profile_id: string
          recipe_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          profile_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      food_logs: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          description: string
          fat: number
          household_id: string
          id: string
          log_date: string
          profile_id: string
          protein: number
          slot: string
          source: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          description: string
          fat?: number
          household_id: string
          id?: string
          log_date?: string
          profile_id: string
          protein?: number
          slot?: string
          source?: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          description?: string
          fat?: number
          household_id?: string
          id?: string
          log_date?: string
          profile_id?: string
          protein?: number
          slot?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_items: {
        Row: {
          amount: string
          category: string
          checked: boolean
          created_at: string
          household_id: string
          id: string
          manual: boolean
          name: string
          week_start: string
        }
        Insert: {
          amount?: string
          category?: string
          checked?: boolean
          created_at?: string
          household_id: string
          id?: string
          manual?: boolean
          name: string
          week_start: string
        }
        Update: {
          amount?: string
          category?: string
          checked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          manual?: boolean
          name?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          monthly_budget: number | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_budget?: number | null
          name?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_budget?: number | null
          name?: string
        }
        Relationships: []
      }
      ingredient_prices: {
        Row: {
          created_at: string
          currency: string
          household_id: string
          id: string
          name: string
          pack_size: number
          price: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          household_id: string
          id?: string
          name: string
          pack_size?: number
          price?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          household_id?: string
          id?: string
          name?: string
          pack_size?: number
          price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_prices_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          cooked: boolean
          created_at: string
          custom_title: string | null
          household_id: string
          id: string
          plan_date: string
          portions: Json
          recipe_id: string | null
          slot: string
          swaps: Json
        }
        Insert: {
          cooked?: boolean
          created_at?: string
          custom_title?: string | null
          household_id: string
          id?: string
          plan_date: string
          portions?: Json
          recipe_id?: string | null
          slot: string
          swaps?: Json
        }
        Update: {
          cooked?: boolean
          created_at?: string
          custom_title?: string | null
          household_id?: string
          id?: string
          plan_date?: string
          portions?: Json
          recipe_id?: string | null
          slot?: string
          swaps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_items: {
        Row: {
          category: string
          created_at: string
          expires_on: string | null
          household_id: string
          id: string
          low_threshold: number
          name: string
          opened_on: string | null
          quantity: number
          staple: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          expires_on?: string | null
          household_id: string
          id?: string
          low_threshold?: number
          name: string
          opened_on?: string | null
          quantity?: number
          staple?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          expires_on?: string | null
          household_id?: string
          id?: string
          low_threshold?: number
          name?: string
          opened_on?: string | null
          quantity?: number
          staple?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_batches: {
        Row: {
          best_before: string | null
          created_at: string
          household_id: string
          id: string
          note: string
          portions_left: number
          portions_total: number
          prepared_on: string
          recipe_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          best_before?: string | null
          created_at?: string
          household_id: string
          id?: string
          note?: string
          portions_left?: number
          portions_total?: number
          prepared_on?: string
          recipe_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          best_before?: string | null
          created_at?: string
          household_id?: string
          id?: string
          note?: string
          portions_left?: number
          portions_total?: number
          prepared_on?: string
          recipe_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_batches_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent: string
          activity_level: string
          age: number | null
          allergies: string[]
          calorie_target: number
          carb_target: number
          created_at: string
          diet_prefs: string[]
          disliked: string[]
          display_name: string
          fat_target: number
          goal: string
          goal_weight_kg: number | null
          height_cm: number | null
          household_id: string
          id: string
          ingredient_rules: Json
          is_owner: boolean
          onboarding_complete: boolean
          protein_target: number
          sex: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          accent?: string
          activity_level?: string
          age?: number | null
          allergies?: string[]
          calorie_target?: number
          carb_target?: number
          created_at?: string
          diet_prefs?: string[]
          disliked?: string[]
          display_name?: string
          fat_target?: number
          goal?: string
          goal_weight_kg?: number | null
          height_cm?: number | null
          household_id: string
          id: string
          ingredient_rules?: Json
          is_owner?: boolean
          onboarding_complete?: boolean
          protein_target?: number
          sex?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          accent?: string
          activity_level?: string
          age?: number | null
          allergies?: string[]
          calorie_target?: number
          carb_target?: number
          created_at?: string
          diet_prefs?: string[]
          disliked?: string[]
          display_name?: string
          fat_target?: number
          goal?: string
          goal_weight_kg?: number | null
          height_cm?: number | null
          household_id?: string
          id?: string
          ingredient_rules?: Json
          is_owner?: boolean
          onboarding_complete?: boolean
          protein_target?: number
          sex?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          base_servings: number
          calories: number
          carbs: number
          cook_minutes: number
          created_at: string
          cuisine: string
          difficulty: string
          emoji: string
          fat: number
          fiber: number
          id: string
          ingredients: Json
          lily_note: string
          meal_types: string[]
          prep_friendly: boolean
          prep_minutes: number
          protein: number
          slug: string
          steps: Json
          tagline: string
          tags: string[]
          title: string
        }
        Insert: {
          base_servings?: number
          calories?: number
          carbs?: number
          cook_minutes?: number
          created_at?: string
          cuisine?: string
          difficulty?: string
          emoji?: string
          fat?: number
          fiber?: number
          id?: string
          ingredients?: Json
          lily_note?: string
          meal_types?: string[]
          prep_friendly?: boolean
          prep_minutes?: number
          protein?: number
          slug: string
          steps?: Json
          tagline?: string
          tags?: string[]
          title: string
        }
        Update: {
          base_servings?: number
          calories?: number
          carbs?: number
          cook_minutes?: number
          created_at?: string
          cuisine?: string
          difficulty?: string
          emoji?: string
          fat?: number
          fiber?: number
          id?: string
          ingredients?: Json
          lily_note?: string
          meal_types?: string[]
          prep_friendly?: boolean
          prep_minutes?: number
          protein?: number
          slug?: string
          steps?: Json
          tagline?: string
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_household: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
