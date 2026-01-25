import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TrackQueryParams {
  userQuery: string;
  assistantResponse: string;
  sourcesCited?: string[];
}

export function useQueryTracking() {
  const trackQuery = useCallback(async (params: TrackQueryParams): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("query_analytics")
        .insert({
          user_query: params.userQuery,
          assistant_response: params.assistantResponse,
          sources_cited: params.sourcesCited || [],
        })
        .select("id")
        .single();

      if (error) {
        console.error("[useQueryTracking] Error tracking query:", error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.error("[useQueryTracking] Unexpected error:", err);
      return null;
    }
  }, []);

  return { trackQuery };
}
