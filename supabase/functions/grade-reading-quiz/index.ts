// Edge Function: grade-reading-quiz
//
// 독해 퀴즈 채점 — Groq Llama 3.3 70B로 3단 피드백 생성.
//
// Request:
//   POST /functions/v1/grade-reading-quiz
//   Authorization: Bearer <anon key>
//   Body: { "sentenceEn": string, "questionKo": string, "answerText": string }
//
// Response:
//   200 → { "good": string, "improve": string, "model": string }
//   400 → { "error": string }
//   500 → { "error": string }
//   429 → { "error": string } (rate limit)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_MODEL = 'llama-3.3-70b-versatile';

declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

type RequestBody = {
  sentenceEn: string;
  questionKo: string;
  answerText: string;
};

function validate(raw: unknown): { ok: true; value: RequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be JSON object.' };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.sentenceEn !== 'string' || obj.sentenceEn.length === 0)
    return { ok: false, error: 'sentenceEn is required.' };
  if (typeof obj.questionKo !== 'string' || obj.questionKo.length === 0)
    return { ok: false, error: 'questionKo is required.' };
  if (typeof obj.answerText !== 'string' || obj.answerText.trim().length === 0)
    return { ok: false, error: 'answerText is required.' };
  return { ok: true, value: obj as unknown as RequestBody };
}

const SYSTEM_PROMPT = `You are a reading comprehension grading assistant for a Korean English-learning app.
The user reads an English sentence and answers a comprehension question in Korean (or simple English).
Your job is to provide 3-part feedback in Korean:

1. "good" — What the user got right (1-2 sentences, encouraging)
2. "improve" — What could be better or was missed (1-2 sentences, specific)
3. "model" — A model answer in Korean (1-2 sentences)

Respond ONLY with a JSON object: {"good": "...", "improve": "...", "model": "..."}
No markdown, no explanation outside the JSON.`;

function buildUserPrompt(body: RequestBody): string {
  return `English sentence: "${body.sentenceEn}"
Question: "${body.questionKo}"
User's answer: "${body.answerText}"

Grade this answer and respond with the JSON feedback.`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return json(400, { error: 'Body must be valid JSON.' }, origin);
  }

  const validation = validate(parsed);
  if (!validation.ok) {
    return json(400, { error: validation.error }, origin);
  }

  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) {
    return json(500, { error: 'Server misconfigured: missing GROQ_API_KEY.' }, origin);
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(validation.value) },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (groqRes.status === 429) {
      return json(429, { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' }, origin);
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq error:', groqRes.status, errText);
      return json(500, { error: 'AI 채점에 실패했어요.' }, origin);
    }

    const groqData = await groqRes.json();
    const content = groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return json(500, { error: 'AI 응답이 비어있어요.' }, origin);
    }

    const feedback = JSON.parse(content);
    if (!feedback.good || !feedback.improve || !feedback.model) {
      return json(500, { error: 'AI 응답 형식이 올바르지 않아요.' }, origin);
    }

    return json(200, feedback, origin);
  } catch (err) {
    console.error('grade-reading-quiz error:', err);
    return json(500, { error: 'AI 채점 중 오류가 발생했어요.' }, origin);
  }
});
