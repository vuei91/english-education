// Edge Function: get-signed-audio-url
//
// Req coverage: 7.2
//
// Returns a short-lived signed URL for a pre-generated audio file in the
// Storage `audio` bucket. The client caches the resulting URL (and —
// once the on-disk driver lands — the downloaded bytes) locally; this
// function is called only when the local cache misses.
//
// Request shape
//   POST /functions/v1/get-signed-audio-url
//   Authorization: Bearer <user jwt | anon key>
//   Body: { "kind": "sentence" | "chunk" | "vocab", "id": string }
//
// Response shape
//   200 → { "url": string, "expiresAt": string /* ISO */ }
//   400 → { "error": string }   invalid body shape
//   404 → { "error": string }   object missing in storage
//   500 → { "error": string }   unexpected / misconfigured
//
// Validation and storage-path construction live in `validateRequest.ts`
// so they can be unit-tested from the app's Jest suite without standing
// up a Deno test runner. This handler is deliberately a thin shell.

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { pathFor, validateRequest } from './validateRequest.ts';

const EXPIRES_IN_SECONDS = 900; // 15 minutes

// Deno-typed globals (no @types/deno import needed in Supabase runtime).
declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders(origin),
    });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Body must be valid JSON.' }, origin);
  }

  const validation = validateRequest(parsed);
  if (!validation.ok) {
    return jsonResponse(400, { error: validation.error }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(
      500,
      { error: 'Server misconfigured: missing Supabase env.' },
      origin,
    );
  }

  // Service-role client is required to sign URLs across user sessions.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.storage
    .from('audio')
    .createSignedUrl(pathFor(validation.value), EXPIRES_IN_SECONDS);

  if (error || !data?.signedUrl) {
    return jsonResponse(
      404,
      { error: error?.message ?? 'Not found.' },
      origin,
    );
  }

  const expiresAt = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString();
  return jsonResponse(200, { url: data.signedUrl, expiresAt }, origin);
});
