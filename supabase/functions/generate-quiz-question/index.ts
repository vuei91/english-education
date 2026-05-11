import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Edge Function: generate-quiz-question
//
// 문장 기반 독해 퀴즈 질문 생성 — Groq Llama 3.1 8B (경량 모델).
// 배치 사전 생성 + 캐싱 대상이지만, MVP에서는 런타임 호출로 시작.
//
// Request:
//   POST /functions/v1/generate-quiz-question
//   Body: { "sentenceEn": string, "sentenceKo"?: string }
//
// Response:
//   200 → { "type": string, "questionKo": string }

const GROQ_MODEL = 'llama-3.1-8b-instant';

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

type RequestBody = { sentenceEn: string; sentenceKo?: string };

function validate(raw: unknown): { ok: true; value: RequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be JSON object.' };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.sentenceEn !== 'string' || obj.sentenceEn.length === 0)
    return { ok: false, error: 'sentenceEn is required.' };
  return { ok: true, value: { sentenceEn: obj.sentenceEn, sentenceKo: typeof obj.sentenceKo === 'string' ? obj.sentenceKo : undefined } };
}

const SYSTEM_PROMPT = `You generate reading comprehension questions for a Korean English-learning app.
Given an English sentence, create ONE question in Korean that tests whether the learner truly understood the sentence.

Question types (pick the most appropriate one):
- "summary": 핵심 요약 (이 문장의 핵심은?)
- "inference": 추론 (왜 이런 상황이 벌어졌을까?)
- "vocab": 어휘 추측 (특정 단어/표현의 의미를 문맥으로 추측)
- "paraphrase": 다른 말로 표현 (같은 의미를 다르게 말하면?)

Respond ONLY with JSON: {"type": "summary|inference|vocab|paraphrase", "questionKo": "..."}
The question must be in Korean. Keep it concise (1 sentence).`;

function buildUserPrompt(body: RequestBody): string {
  let prompt = `English sentence: "${body.sentenceEn}"`;
  if (body.sentenceKo) {
    prompt += `\nKorean translation (for reference): "${body.sentenceKo}"`;
  }
  prompt += '\n\nGenerate one comprehension question.';
  return prompt;
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
        temperature: 0.5,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (groqRes.status === 429) {
      return json(429, { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' }, origin);
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq error:', groqRes.status, errText);
      return json(500, { error: '질문 생성에 실패했어요.' }, origin);
    }

    const groqData = await groqRes.json();
    const content = groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return json(500, { error: 'AI 응답이 비어있어요.' }, origin);
    }

    const question = JSON.parse(content);
    if (!question.type || !question.questionKo) {
      return json(500, { error: 'AI 응답 형식이 올바르지 않아요.' }, origin);
    }

    return json(200, question, origin);
  } catch (err) {
    console.error('generate-quiz-question error:', err);
    return json(500, { error: '질문 생성 중 오류가 발생했어요.' }, origin);
  }
});
