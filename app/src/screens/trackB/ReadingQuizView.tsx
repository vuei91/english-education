import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getSupabaseClient } from '../../lib/supabase';
import { QuizService } from '../../services/quiz';
import { useTheme, type Theme } from '../../theme';

/**
 * ReadingQuizView — 주관식 독해 퀴즈 (기획 6-1-3).
 *
 * 사용자가 문장을 읽고 자기 말로 답하면 AI가 3단 피드백을 제공한다.
 * Edge Function(Groq 70B)으로 채점. 실패 시 목업 폴백.
 */

export type QuizQuestion = {
  type: string;
  questionKo: string;
};

export type QuizFeedback = {
  good: string;
  improve: string;
  model: string;
};

type Props = {
  sentenceEn: string;
  sentenceKo?: string | null;
  question?: QuizQuestion;
  onPrev?: () => void;
  onComplete: () => void;
  onQuestionGenerated?: (q: QuizQuestion) => void;
};

/** 문장 기반 기본 질문 생성 (서버 연동 전 폴백) */
function getDefaultQuestion(): QuizQuestion {
  return {
    type: 'summary',
    questionKo: '이 문장이 말하고자 하는 핵심을 한국어로 요약해 보세요.',
  };
}

/** 목업 피드백 (AI 실패 시 폴백) */
function getMockFeedback(answer: string, sentenceEn: string): QuizFeedback {
  if (answer.trim().length < 5) {
    return {
      good: '답변을 작성해 주셨네요.',
      improve: '좀 더 구체적으로 문장의 핵심 내용을 포함해 보세요.',
      model: `"${sentenceEn}"의 핵심 내용을 한국어로 풀어서 작성해 보세요.`,
    };
  }
  return {
    good: '핵심 내용을 잘 파악했어요!',
    improve: '세부 디테일(시간, 장소, 이유 등)도 포함하면 더 좋아요.',
    model: '(채점 서버에 연결할 수 없어 기본 피드백을 표시합니다)',
  };
}

export default function ReadingQuizView({ sentenceEn, sentenceKo, question, onPrev, onComplete, onQuestionGenerated }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const quizServiceRef = useRef<QuizService | null>(null);
  const getQuizService = useCallback(() => {
    if (!quizServiceRef.current) {
      quizServiceRef.current = new QuizService(getSupabaseClient());
    }
    return quizServiceRef.current;
  }, []);

  const [aiQuestion, setAiQuestion] = useState<QuizQuestion | null>(null);
  const [questionLoading, setQuestionLoading] = useState(!question);
  const q = question ?? aiQuestion ?? getDefaultQuestion();
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [grading, setGrading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // AI 질문 생성 (prop으로 안 넘어왔을 때)
  useEffect(() => {
    if (question) return; // 이미 외부에서 제공됨
    let cancelled = false;
    void (async () => {
      try {
        const svc = getQuizService();
        const result = await svc.generateQuestion(sentenceEn, sentenceKo);
        if (!cancelled && result.question) {
          setAiQuestion(result.question);
          onQuestionGenerated?.(result.question);
        }
      } finally {
        if (!cancelled) setQuestionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sentenceEn, sentenceKo, question, getQuizService, onQuestionGenerated]);

  const handleSubmit = useCallback(async () => {
    if (answer.trim().length === 0) return;
    setGrading(true);
    try {
      const svc = getQuizService();
      const result = await svc.gradeAnswer(sentenceEn, q.questionKo, answer);
      if (result.feedback) {
        setFeedback(result.feedback);
      } else {
        // AI 실패 시 목업 폴백
        setFeedback(getMockFeedback(answer, sentenceEn));
      }
    } catch {
      setFeedback(getMockFeedback(answer, sentenceEn));
    } finally {
      setGrading(false);
      setSubmitted(true);
    }
  }, [answer, sentenceEn, q.questionKo, getQuizService]);

  const handleRetry = useCallback(() => {
    setAnswer('');
    setFeedback(null);
    setSubmitted(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* 원문 + 한글 해석 토글 */}
      <View style={styles.passageBox}>
        <Text style={styles.passageText}>{sentenceEn}</Text>
        {sentenceKo ? (
          showTranslation ? (
            <Pressable
              onPress={() => setShowTranslation(false)}
              accessibilityRole="button"
              accessibilityLabel="한글 해석 숨기기"
            >
              <Text style={styles.translationText}>{sentenceKo}</Text>
              <Text style={styles.toggleHint}>탭하여 숨기기</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowTranslation(true)}
              accessibilityRole="button"
              accessibilityLabel="한글 해석 보기"
              style={({ pressed }) => [
                styles.toggleButton,
                { borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.toggleButtonText, { color: theme.colors.textMuted }]}>
                한글 해석 보기
              </Text>
            </Pressable>
          )
        ) : null}
      </View>

      {/* 퀴즈 */}
      <Text style={styles.label}>📝 독해 퀴즈</Text>
      {questionLoading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Text style={styles.question}>{q.questionKo}</Text>
      )}

      {!submitted ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="여기에 답변을 작성하세요"
            placeholderTextColor={theme.colors.textMuted}
            value={answer}
            onChangeText={setAnswer}
            multiline
            textAlignVertical="top"
            accessibilityLabel="독해 퀴즈 답변 입력"
          />
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전"
              onPress={onPrev}
              disabled={!onPrev}
              style={({ pressed }) => [
                styles.skipButton,
                { borderColor: theme.colors.border, opacity: !onPrev ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>← 이전</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="제출하기"
              onPress={() => void handleSubmit()}
              disabled={answer.trim().length === 0 || grading}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: answer.trim().length === 0 || grading ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {grading ? (
                <ActivityIndicator size="small" color={theme.colors.primaryOn} />
              ) : (
                <Text style={[styles.submitText, { color: theme.colors.primaryOn }]}>제출</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : feedback ? (
        <View style={styles.feedbackContainer}>
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>잘 짚은 점</Text>
              <Text style={styles.feedbackBody}>{feedback.good}</Text>
            </View>
          </View>
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>보완하면 좋을 점</Text>
              <Text style={styles.feedbackBody}>{feedback.improve}</Text>
            </View>
          </View>
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackIcon}>📝</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>모범 답안 예시</Text>
              <Text style={styles.feedbackBody}>{feedback.model}</Text>
            </View>
          </View>
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다시 답해보기"
              onPress={handleRetry}
              style={({ pressed }) => [
                styles.skipButton,
                { borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>다시 답해보기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다음 문장"
              onPress={onComplete}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.submitText, { color: theme.colors.primaryOn }]}>다음 문장</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    passageBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    passageText: {
      ...theme.typography.body,
      color: theme.colors.text,
      lineHeight: 24,
    },
    translationText: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
      marginTop: theme.spacing.sm,
    },
    toggleHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    toggleButton: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      marginTop: theme.spacing.sm,
    },
    toggleButtonText: {
      ...theme.typography.caption,
    },
    label: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    question: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    input: {
      ...theme.typography.body,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      minHeight: 100,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    skipButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    skipText: {
      ...theme.typography.button,
    },
    submitButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
    submitText: {
      ...theme.typography.button,
    },
    feedbackContainer: {
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    feedbackSection: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    feedbackIcon: {
      fontSize: 18,
      marginTop: 2,
    },
    feedbackTitle: {
      ...theme.typography.caption,
      color: theme.colors.textSubtle,
      fontWeight: '600',
      marginBottom: 2,
    },
    feedbackBody: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
  });
}
