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
      api_usage_stats: {
        Row: {
          created_at: string
          id: string
          mode: string
          model: string
          provider: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: string
          model: string
          provider: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          model?: string
          provider?: string
        }
        Relationships: []
      }
      chat_metrics: {
        Row: {
          created_at: string | null
          embedding_latency_ms: number | null
          error_type: string | null
          fallback_triggered: boolean | null
          id: string
          llm_first_token_ms: number | null
          llm_total_ms: number | null
          local_chunks_found: number | null
          mode: string | null
          model: string | null
          provider: string | null
          rate_limit_hit: boolean | null
          request_id: string | null
          search_latency_ms: number | null
          session_fingerprint: string | null
          web_search_used: boolean | null
          web_sources_count: number | null
        }
        Insert: {
          created_at?: string | null
          embedding_latency_ms?: number | null
          error_type?: string | null
          fallback_triggered?: boolean | null
          id?: string
          llm_first_token_ms?: number | null
          llm_total_ms?: number | null
          local_chunks_found?: number | null
          mode?: string | null
          model?: string | null
          provider?: string | null
          rate_limit_hit?: boolean | null
          request_id?: string | null
          search_latency_ms?: number | null
          session_fingerprint?: string | null
          web_search_used?: boolean | null
          web_sources_count?: number | null
        }
        Update: {
          created_at?: string | null
          embedding_latency_ms?: number | null
          error_type?: string | null
          fallback_triggered?: boolean | null
          id?: string
          llm_first_token_ms?: number | null
          llm_total_ms?: number | null
          local_chunks_found?: number | null
          mode?: string | null
          model?: string | null
          provider?: string | null
          rate_limit_hit?: boolean | null
          request_id?: string | null
          search_latency_ms?: number | null
          session_fingerprint?: string | null
          web_search_used?: boolean | null
          web_sources_count?: number | null
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_access_log: {
        Row: {
          access_type: string
          accessed_by: string | null
          created_at: string
          document_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          access_type?: string
          accessed_by?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_by?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string | null
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          search_vector: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          content_hash?: string | null
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          search_vector?: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string | null
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          search_vector?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_jobs: {
        Row: {
          batch_hashes: Json | null
          completed_at: string | null
          created_at: string
          document_id: string
          error: string | null
          id: string
          last_batch_index: number | null
          last_error_at: string | null
          max_retries: number | null
          next_page: number
          pages_per_batch: number
          retry_count: number | null
          started_at: string | null
          status: string
          total_batches: number | null
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          batch_hashes?: Json | null
          completed_at?: string | null
          created_at?: string
          document_id: string
          error?: string | null
          id?: string
          last_batch_index?: number | null
          last_error_at?: string | null
          max_retries?: number | null
          next_page?: number
          pages_per_batch?: number
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_batches?: number | null
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          batch_hashes?: Json | null
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error?: string | null
          id?: string
          last_batch_index?: number | null
          last_error_at?: string | null
          max_retries?: number | null
          next_page?: number
          pages_per_batch?: number
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_batches?: number | null
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          chunk_count: number | null
          content_hash: string | null
          content_text: string | null
          created_at: string
          effective_date: string | null
          error_reason: string | null
          file_path: string | null
          id: string
          processed_at: string | null
          source_file_name: string | null
          status: string
          supersedes_document_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          version: number | null
          version_label: string | null
        }
        Insert: {
          category?: string
          chunk_count?: number | null
          content_hash?: string | null
          content_text?: string | null
          created_at?: string
          effective_date?: string | null
          error_reason?: string | null
          file_path?: string | null
          id?: string
          processed_at?: string | null
          source_file_name?: string | null
          status?: string
          supersedes_document_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number | null
          version_label?: string | null
        }
        Update: {
          category?: string
          chunk_count?: number | null
          content_hash?: string | null
          content_text?: string | null
          created_at?: string
          effective_date?: string | null
          error_reason?: string | null
          file_path?: string | null
          id?: string
          processed_at?: string | null
          source_file_name?: string | null
          status?: string
          supersedes_document_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number | null
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      frontend_errors: {
        Row: {
          component_stack: string | null
          created_at: string | null
          error_message: string | null
          id: string
          url: string | null
          user_agent: string | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      processing_metrics: {
        Row: {
          created_at: string | null
          document_id: string | null
          duration_ms: number
          error_message: string | null
          id: string
          metadata: Json | null
          step: string
          success: boolean
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          duration_ms: number
          error_message?: string | null
          id?: string
          metadata?: Json | null
          step: string
          success: boolean
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          duration_ms?: number
          error_message?: string | null
          id?: string
          metadata?: Json | null
          step?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "processing_metrics_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_seen_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_seen_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      query_analytics: {
        Row: {
          assistant_response: string
          created_at: string
          id: string
          session_fingerprint: string | null
          sources_cited: string[] | null
          user_query: string
        }
        Insert: {
          assistant_response: string
          created_at?: string
          id?: string
          session_fingerprint?: string | null
          sources_cited?: string[] | null
          user_query: string
        }
        Update: {
          assistant_response?: string
          created_at?: string
          id?: string
          session_fingerprint?: string | null
          sources_cited?: string[] | null
          user_query?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          client_key: string
          created_at: string
          endpoint: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          client_key: string
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          client_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      report_tag_relations: {
        Row: {
          created_at: string
          id: string
          report_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_tag_relations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "development_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "report_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      report_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      response_feedback: {
        Row: {
          created_at: string
          feedback_category: string | null
          feedback_text: string | null
          id: string
          query_id: string
          rating: boolean
        }
        Insert: {
          created_at?: string
          feedback_category?: string | null
          feedback_text?: string | null
          id?: string
          query_id: string
          rating: boolean
        }
        Update: {
          created_at?: string
          feedback_category?: string | null
          feedback_text?: string | null
          id?: string
          query_id?: string
          rating?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "response_feedback_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "query_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      search_metrics: {
        Row: {
          created_at: string | null
          id: string
          keyword_search_ms: number | null
          query_hash: string
          results_returned: number | null
          threshold_used: number | null
          total_chunks_scanned: number | null
          vector_search_ms: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword_search_ms?: number | null
          query_hash: string
          results_returned?: number | null
          threshold_used?: number | null
          total_chunks_scanned?: number | null
          vector_search_ms?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword_search_ms?: number | null
          query_hash?: string
          results_returned?: number | null
          threshold_used?: number | null
          total_chunks_scanned?: number | null
          vector_search_ms?: number | null
        }
        Relationships: []
      }
      trusted_domains: {
        Row: {
          category: string
          created_at: string
          description: string | null
          domain: string
          id: string
          priority: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          priority?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          priority?: number
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      web_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          fetched_pages: Json | null
          hit_count: number
          id: string
          mode: string
          query_hash: string
          query_text: string
          serp_results: Json | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          fetched_pages?: Json | null
          hit_count?: number
          id?: string
          mode: string
          query_hash: string
          query_text: string
          serp_results?: Json | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          fetched_pages?: Json | null
          hit_count?: number
          id?: string
          mode?: string
          query_hash?: string
          query_text?: string
          serp_results?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_client_key: string
          p_endpoint: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          reset_in: number
        }[]
      }
      cleanup_expired_web_cache: { Args: never; Returns: number }
      cleanup_old_chat_sessions: {
        Args: { days_old?: number }
        Returns: number
      }
      cleanup_rate_limits: { Args: never; Returns: number }
      get_api_usage_stats: {
        Args: { p_days?: number }
        Returns: {
          date: string
          mode: string
          model: string
          provider: string
          total_count: number
        }[]
      }
      get_api_usage_summary: {
        Args: { p_days?: number }
        Returns: {
          percentage: number
          provider: string
          total_count: number
        }[]
      }
      get_cached_web_search: {
        Args: { p_mode: string; p_query_hash: string }
        Returns: {
          fetched_pages: Json
          hit_count: number
          id: string
          serp_results: Json
        }[]
      }
      get_chat_metrics_summary: {
        Args: { p_days?: number }
        Returns: {
          avg_embedding_ms: number
          avg_llm_first_token_ms: number
          avg_llm_total_ms: number
          avg_search_ms: number
          date: string
          error_count: number
          fallback_count: number
          gemini_count: number
          lovable_count: number
          rate_limit_hits: number
          total_requests: number
          web_search_count: number
        }[]
      }
      get_chat_storage_stats: {
        Args: never
        Returns: {
          newest_session: string
          oldest_session: string
          total_sessions: number
          total_size_bytes: number
        }[]
      }
      get_document_file_path: {
        Args: { p_document_id: string }
        Returns: string
      }
      get_documents_for_retry: {
        Args: never
        Returns: {
          error_reason: string
          id: string
          last_batch_index: number
          status: string
          title: string
          total_batches: number
          updated_at: string
        }[]
      }
      get_domain_info: {
        Args: { p_url: string }
        Returns: {
          category: string
          description: string
          domain: string
          priority: number
        }[]
      }
      get_fallback_rate: {
        Args: { p_days?: number }
        Returns: {
          day: string
          fallback_rate: number
          fallback_requests: number
          total_requests: number
        }[]
      }
      get_frontend_errors_summary: {
        Args: { p_days?: number }
        Returns: {
          chrome_count: number
          date: string
          edge_count: number
          firefox_count: number
          mobile_count: number
          other_count: number
          safari_count: number
          total_errors: number
          unique_messages: number
        }[]
      }
      get_ingestion_resume_point: {
        Args: { p_document_id: string }
        Returns: {
          job_status: string
          last_hash: string
          resume_from_batch: number
          total_batches_recorded: number
        }[]
      }
      get_processing_stats: {
        Args: { p_days?: number }
        Returns: {
          avg_duration_ms: number
          failed_count: number
          max_duration_ms: number
          min_duration_ms: number
          step: string
          success_rate: number
          total_count: number
        }[]
      }
      get_recent_processing_errors: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          document_id: string
          document_title: string
          duration_ms: number
          error_message: string
          id: string
          step: string
        }[]
      }
      get_search_performance_stats: {
        Args: { p_days?: number }
        Returns: {
          avg_keyword_ms: number
          avg_results: number
          avg_total_chunks: number
          avg_vector_ms: number
          p95_vector_ms: number
          total_searches: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search_chunks: {
        Args: {
          keyword_weight?: number
          match_count?: number
          match_threshold?: number
          query_embedding: string
          query_text: string
          vector_weight?: number
        }
        Returns: {
          chunk_index: number
          combined_score: number
          content: string
          document_id: string
          id: string
          metadata: Json
          similarity: number
          text_rank: number
        }[]
      }
      log_document_access: {
        Args: {
          p_access_type?: string
          p_accessed_by?: string
          p_document_id: string
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: string
      }
      record_batch_processed: {
        Args: {
          p_batch_hash: string
          p_batch_index: number
          p_document_id: string
        }
        Returns: {
          existing_hash: string
          is_duplicate: boolean
        }[]
      }
      save_web_search_cache: {
        Args: {
          p_fetched_pages: Json
          p_mode: string
          p_query_hash: string
          p_query_text: string
          p_serp_results: Json
        }
        Returns: string
      }
      search_document_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      upsert_document_chunks: {
        Args: { p_chunks: Json; p_document_id: string }
        Returns: number
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
