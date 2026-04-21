import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export interface RateLimitOptions {
  admin: SupabaseClient;
  bucket: string;
  key: string;
  maxRequests: number;
  windowSeconds: number;
}

// Fixed-window counter backed by public.edge_rate_limits. Fails open on DB
// errors so a transient hiccup does not black-hole legitimate traffic — this
// matches parse-advance's own rate-limit behaviour.
export async function checkRateLimit({
  admin,
  bucket,
  key,
  maxRequests,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error: countErr } = await admin
    .from("edge_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key", key)
    .gte("created_at", windowStart);

  if (countErr) {
    console.error(`rate-limit count failed (${bucket}):`, countErr.message);
    return { allowed: true };
  }
  if ((count ?? 0) >= maxRequests) {
    return { allowed: false, retryAfterSec: windowSeconds };
  }

  const { error: insertErr } = await admin
    .from("edge_rate_limits")
    .insert({ bucket, key });
  if (insertErr) {
    console.error(`rate-limit insert failed (${bucket}):`, insertErr.message);
  }
  return { allowed: true };
}
