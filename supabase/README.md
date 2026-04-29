# Supabase schema

This directory holds the source of truth for the server-side schema:
migrations, policies, and Edge Functions. All changes to the database
should land here as a new file and be applied to the project.

## Layout

```
supabase/
├── migrations/         SQL migration files (timestamp_name.sql)
│   ├── 20260429_000100_content_tables.sql
│   ├── 20260429_000200_user_tables.sql
│   └── 20260429_000300_row_level_security.sql
└── functions/          Edge Functions (Deno)
    └── get-signed-audio-url/
        ├── index.ts              HTTP handler (Deno)
        └── validateRequest.ts    Pure validator (Jest-tested from app/)
```

## `get-signed-audio-url` contract

- **Request** (`POST /functions/v1/get-signed-audio-url`, JSON body):
  `{ "kind": "sentence" | "chunk" | "vocab", "id": string }`
- **Response** (200): `{ "url": string, "expiresAt": string /* ISO */ }`
- **Storage object path** (bucket `audio`):
  - `sentences/{id}.m4a`
  - `chunks/{id}.m4a`
  - `vocab/{id}.m4a`

The three kinds match `AudioCacheKind` in `app/src/services/audio/AudioCache.ts`,
so client and server agree without a translation layer.

## Applying migrations (manual, no CLI yet)

1. Open the Supabase dashboard → your project → **SQL Editor**.
2. Run each migration file in order, top to bottom.
3. After every run, refresh the **Table Editor** to confirm the expected
   tables and policies appear.

Once the Supabase CLI is installed, these same files will be picked up by
`supabase db push` automatically.

## Applying Edge Functions (manual, no CLI yet)

1. Open **Edge Functions** in the dashboard.
2. Create a function named `get-signed-audio-url`.
3. Copy `functions/get-signed-audio-url/index.ts` into the inline editor.
4. Deploy.

## RLS policy summary

- **Content tables** (`sentences`, `chunks`, `sentence_summary`,
  `pattern_drills`, `vocab_entries`): public read only when `status='production'`.
  Writes restricted to the service role (used by the content pipeline).
- **User tables** (`user_sentence_progress`, `user_word_tap`,
  `user_daily_progress`, `user_streak`, `user_rewards_log`):
  `user_id = auth.uid()` for select/insert/update/delete.
