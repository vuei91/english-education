import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * QuizService — 독해 퀴즈 채점을 Edge Function 경유로 처리.
 *
 * 기획 원칙:
 *   - 채점은 Groq 70B (grade-reading-quiz Edge Function)
 *   - 일일 5회 무료, 추가는 Rewarded Ad (한도 체크는 추후)
 *   - 429 시 사용자에게 안내
 */

export type QuizFeedback = {
  good: string;
  improve: string;
  model: string;
};

export type QuizQuestion = {
  type: string;
  questionKo: string;
};

export class QuizService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** AI 질문 생성. 실패 시 null 반환. */
  async generateQuestion(
    sentenceEn: string,
    sentenceKo?: string | null,
  ): Promise<{ question: QuizQuestion | null; error?: string }> {
    try {
      const { data, error } = await this.supabase.functions.invoke('generate-quiz-question', {
        body: { sentenceEn, sentenceKo: sentenceKo ?? undefined },
      });
      if (error) {
        return { question: null, error: (error as { message?: string }).message ?? '질문 생성 실패' };
      }
      if (data && data.type && data.questionKo) {
        return { question: data as QuizQuestion };
      }
      return { question: null, error: 'AI 응답 형식 오류' };
    } catch (err) {
      return { question: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** AI 채점 요청. */
  async gradeAnswer(
    sentenceEn: string,
    questionKo: string,
    answerText: string,
  ): Promise<{ feedback: QuizFeedback | null; error?: string }> {
    try {
      const { data, error } = await this.supabase.functions.invoke('grade-reading-quiz', {
        body: { sentenceEn, questionKo, answerText },
      });

      if (error) {
        // Supabase SDK wraps non-2xx as FunctionsHttpError
        const msg = (error as { message?: string }).message ?? 'AI 채점에 실패했어요.';
        return { feedback: null, error: msg };
      }

      if (data && data.good && data.improve && data.model) {
        return { feedback: data as QuizFeedback };
      }

      return { feedback: null, error: 'AI 응답 형식이 올바르지 않아요.' };
    } catch (err) {
      return { feedback: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
