export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      daily_log_items: {
        Row: {
          created_at: string;
          daily_log_id: string;
          id: string;
          meal_instance_id: string | null;
          meal_name: string | null;
          meal_template_id: string | null;
          product_id: string;
          quantity_g: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          daily_log_id: string;
          id?: string;
          meal_instance_id?: string | null;
          meal_name?: string | null;
          meal_template_id?: string | null;
          product_id: string;
          quantity_g?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          daily_log_id?: string;
          id?: string;
          meal_instance_id?: string | null;
          meal_name?: string | null;
          meal_template_id?: string | null;
          product_id?: string;
          quantity_g?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_log_items_daily_log_id_fkey";
            columns: ["daily_log_id"];
            isOneToOne: false;
            referencedRelation: "daily_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_log_items_meal_template_id_fkey";
            columns: ["meal_template_id"];
            isOneToOne: false;
            referencedRelation: "meal_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_log_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_logs: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      meal_template_items: {
        Row: {
          created_at: string;
          default_quantity_g: number;
          id: string;
          meal_template_id: string;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_quantity_g?: number;
          id?: string;
          meal_template_id: string;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_quantity_g?: number;
          id?: string;
          meal_template_id?: string;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_template_items_meal_template_id_fkey";
            columns: ["meal_template_id"];
            isOneToOne: false;
            referencedRelation: "meal_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_template_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      meal_templates: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_blocks: {
        Row: {
          block_type: string | null;
          created_at: string;
          day_plan_id: string;
          display_order: number;
          id: string;
          notes: string | null;
          seed_key: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          block_type?: string | null;
          created_at?: string;
          day_plan_id: string;
          display_order: number;
          id?: string;
          notes?: string | null;
          seed_key: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          block_type?: string | null;
          created_at?: string;
          day_plan_id?: string;
          display_order?: number;
          id?: string;
          notes?: string | null;
          seed_key?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_blocks_day_plan_id_fkey";
            columns: ["day_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_day_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_day_plans: {
        Row: {
          cap_text: string | null;
          category: string;
          created_at: string;
          day_of_week: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
          day_order: number;
          id: string;
          notes: string | null;
          plan_id: string;
          seed_key: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          cap_text?: string | null;
          category: string;
          created_at?: string;
          day_of_week: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
          day_order: number;
          id?: string;
          notes?: string | null;
          plan_id: string;
          seed_key: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          cap_text?: string | null;
          category?: string;
          created_at?: string;
          day_of_week?: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
          day_order?: number;
          id?: string;
          notes?: string | null;
          plan_id?: string;
          seed_key?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_day_plans_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_exercise_logs: {
        Row: {
          actual_duration: string | null;
          actual_load: string | null;
          actual_name: string | null;
          actual_reps: string | null;
          actual_sets: string | null;
          actual_variation: string | null;
          change_reason: "fatigue" | "pain" | "time" | "felt_strong" | "equipment" | "other" | null;
          completed_set_count: number | null;
          created_at: string;
          exercise_type:
            | "isometric"
            | "reps"
            | "assisted"
            | "accessory"
            | "cardio"
            | "notes"
            | null;
          exercise_plan_id: string;
          id: string;
          notes: string | null;
          order_index: number | null;
          planned_name: string | null;
          rest_target: string | null;
          session_log_id: string;
          set_checklist: Json;
          status:
            | "not_started"
            | "in_progress"
            | "completed"
            | "partial"
            | "skipped"
            | "completed_as_planned"
            | "completed_modified"
            | "substituted"
            | "overperformed";
          target: Json;
          updated_at: string;
        };
        Insert: {
          actual_duration?: string | null;
          actual_load?: string | null;
          actual_name?: string | null;
          actual_reps?: string | null;
          actual_sets?: string | null;
          actual_variation?: string | null;
          change_reason?:
            | "fatigue"
            | "pain"
            | "time"
            | "felt_strong"
            | "equipment"
            | "other"
            | null;
          completed_set_count?: number | null;
          created_at?: string;
          exercise_type?:
            | "isometric"
            | "reps"
            | "assisted"
            | "accessory"
            | "cardio"
            | "notes"
            | null;
          exercise_plan_id: string;
          id?: string;
          notes?: string | null;
          order_index?: number | null;
          planned_name?: string | null;
          rest_target?: string | null;
          session_log_id: string;
          set_checklist?: Json;
          status?:
            | "not_started"
            | "in_progress"
            | "completed"
            | "partial"
            | "skipped"
            | "completed_as_planned"
            | "completed_modified"
            | "substituted"
            | "overperformed";
          target?: Json;
          updated_at?: string;
        };
        Update: {
          actual_duration?: string | null;
          actual_load?: string | null;
          actual_name?: string | null;
          actual_reps?: string | null;
          actual_sets?: string | null;
          actual_variation?: string | null;
          change_reason?:
            | "fatigue"
            | "pain"
            | "time"
            | "felt_strong"
            | "equipment"
            | "other"
            | null;
          completed_set_count?: number | null;
          created_at?: string;
          exercise_type?:
            | "isometric"
            | "reps"
            | "assisted"
            | "accessory"
            | "cardio"
            | "notes"
            | null;
          exercise_plan_id?: string;
          id?: string;
          notes?: string | null;
          order_index?: number | null;
          planned_name?: string | null;
          rest_target?: string | null;
          session_log_id?: string;
          set_checklist?: Json;
          status?:
            | "not_started"
            | "in_progress"
            | "completed"
            | "partial"
            | "skipped"
            | "completed_as_planned"
            | "completed_modified"
            | "substituted"
            | "overperformed";
          target?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercise_logs_exercise_plan_id_fkey";
            columns: ["exercise_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_exercise_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_exercise_logs_session_log_id_fkey";
            columns: ["session_log_id"];
            isOneToOne: false;
            referencedRelation: "workout_session_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_exercise_plans: {
        Row: {
          block_id: string;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          notes: string | null;
          planned_duration: string | null;
          planned_reps: string | null;
          planned_rest: string | null;
          planned_sets: string | null;
          planned_tempo: string | null;
          planned_variation: string | null;
          seed_key: string;
          updated_at: string;
        };
        Insert: {
          block_id: string;
          created_at?: string;
          display_order: number;
          id?: string;
          name: string;
          notes?: string | null;
          planned_duration?: string | null;
          planned_reps?: string | null;
          planned_rest?: string | null;
          planned_sets?: string | null;
          planned_tempo?: string | null;
          planned_variation?: string | null;
          seed_key: string;
          updated_at?: string;
        };
        Update: {
          block_id?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          notes?: string | null;
          planned_duration?: string | null;
          planned_reps?: string | null;
          planned_rest?: string | null;
          planned_sets?: string | null;
          planned_tempo?: string | null;
          planned_variation?: string | null;
          seed_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercise_plans_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "workout_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_plans: {
        Row: {
          created_at: string;
          goal_context: Json;
          id: string;
          name: string;
          seed_key: string | null;
          status: "active" | "draft" | "archived";
          updated_at: string;
          user_id: string;
          version: number;
          week_start_date: string | null;
        };
        Insert: {
          created_at?: string;
          goal_context?: Json;
          id?: string;
          name: string;
          seed_key?: string | null;
          status?: "active" | "draft" | "archived";
          updated_at?: string;
          user_id: string;
          version: number;
          week_start_date?: string | null;
        };
        Update: {
          created_at?: string;
          goal_context?: Json;
          id?: string;
          name?: string;
          seed_key?: string | null;
          status?: "active" | "draft" | "archived";
          updated_at?: string;
          user_id?: string;
          version?: number;
          week_start_date?: string | null;
        };
        Relationships: [];
      };
      workout_session_logs: {
        Row: {
          created_at: string;
          date: string;
          day_plan_id: string;
          duration_minutes: number | null;
          ended_at: string | null;
          energy: number | null;
          id: string;
          notes: string | null;
          pain_flags: Json;
          plan_id: string;
          rpe: number | null;
          started_at: string | null;
          status:
            | "not_started"
            | "in_progress"
            | "completed"
            | "partially_completed"
            | "modified"
            | "cut_short"
            | "skipped";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          day_plan_id: string;
          duration_minutes?: number | null;
          ended_at?: string | null;
          energy?: number | null;
          id?: string;
          notes?: string | null;
          pain_flags?: Json;
          plan_id: string;
          rpe?: number | null;
          started_at?: string | null;
          status?:
            | "not_started"
            | "in_progress"
            | "completed"
            | "partially_completed"
            | "modified"
            | "cut_short"
            | "skipped";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          day_plan_id?: string;
          duration_minutes?: number | null;
          ended_at?: string | null;
          energy?: number | null;
          id?: string;
          notes?: string | null;
          pain_flags?: Json;
          plan_id?: string;
          rpe?: number | null;
          started_at?: string | null;
          status?:
            | "not_started"
            | "in_progress"
            | "completed"
            | "partially_completed"
            | "modified"
            | "cut_short"
            | "skipped";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_session_logs_day_plan_id_fkey";
            columns: ["day_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_day_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_session_logs_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sets: {
        Row: {
          assistance: string | null;
          cardio_distance: string | null;
          cardio_duration_minutes: number | null;
          change_reason: "fatigue" | "pain" | "time" | "felt_strong" | "equipment" | "other" | null;
          created_at: string;
          id: string;
          intensity: string | null;
          load: string | null;
          note: string | null;
          planned_target: Json;
          quality:
            | "clean"
            | "okay"
            | "normal"
            | "mid"
            | "bad"
            | "shaky"
            | "grindy"
            | "bad_line"
            | "technical_fail"
            | "failed"
            | "pain"
            | null;
          range_of_motion: string | null;
          reps: number | null;
          rir: number | null;
          rpe: number | null;
          seconds: number | null;
          session_exercise_log_id: string;
          set_index: number;
          skipped: boolean;
          surface: string | null;
          updated_at: string;
          variation: string | null;
        };
        Insert: {
          assistance?: string | null;
          cardio_distance?: string | null;
          cardio_duration_minutes?: number | null;
          change_reason?:
            | "fatigue"
            | "pain"
            | "time"
            | "felt_strong"
            | "equipment"
            | "other"
            | null;
          created_at?: string;
          id?: string;
          intensity?: string | null;
          load?: string | null;
          note?: string | null;
          planned_target?: Json;
          quality?:
            | "clean"
            | "okay"
            | "normal"
            | "mid"
            | "bad"
            | "shaky"
            | "grindy"
            | "bad_line"
            | "technical_fail"
            | "failed"
            | "pain"
            | null;
          range_of_motion?: string | null;
          reps?: number | null;
          rir?: number | null;
          rpe?: number | null;
          seconds?: number | null;
          session_exercise_log_id: string;
          set_index: number;
          skipped?: boolean;
          surface?: string | null;
          updated_at?: string;
          variation?: string | null;
        };
        Update: {
          assistance?: string | null;
          cardio_distance?: string | null;
          cardio_duration_minutes?: number | null;
          change_reason?:
            | "fatigue"
            | "pain"
            | "time"
            | "felt_strong"
            | "equipment"
            | "other"
            | null;
          created_at?: string;
          id?: string;
          intensity?: string | null;
          load?: string | null;
          note?: string | null;
          planned_target?: Json;
          quality?:
            | "clean"
            | "okay"
            | "normal"
            | "mid"
            | "bad"
            | "shaky"
            | "grindy"
            | "bad_line"
            | "technical_fail"
            | "failed"
            | "pain"
            | null;
          range_of_motion?: string | null;
          reps?: number | null;
          rir?: number | null;
          rpe?: number | null;
          seconds?: number | null;
          session_exercise_log_id?: string;
          set_index?: number;
          skipped?: boolean;
          surface?: string | null;
          updated_at?: string;
          variation?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sets_session_exercise_log_id_fkey";
            columns: ["session_exercise_log_id"];
            isOneToOne: false;
            referencedRelation: "workout_exercise_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      weight_logs: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
          weight_kg: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          brand: string | null;
          calories_per_100g: number;
          category: string;
          carbs_per_100g: number;
          created_at: string;
          fat_per_100g: number;
          id: string;
          name: string;
          notes: string | null;
          protein_per_100g: number;
          source_image_url: string | null;
          source_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          brand?: string | null;
          calories_per_100g?: number;
          category?: string;
          carbs_per_100g?: number;
          created_at?: string;
          fat_per_100g?: number;
          id?: string;
          name: string;
          notes?: string | null;
          protein_per_100g?: number;
          source_image_url?: string | null;
          source_type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand?: string | null;
          calories_per_100g?: number;
          category?: string;
          carbs_per_100g?: number;
          created_at?: string;
          fat_per_100g?: number;
          id?: string;
          name?: string;
          notes?: string | null;
          protein_per_100g?: number;
          source_image_url?: string | null;
          source_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
