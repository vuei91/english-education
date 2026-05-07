import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthService } from '../services/auth';
import { useUserStore } from '../stores';
import { useTheme, type Theme } from '../theme';
import type { Track } from '../types/domain';

/**
 * 2-step onboarding flow (Task 14.1–14.4, Req 18).
 *
 * 1. Speech-free disclaimer — surfaces the core product principle up front
 *    so users never feel ambushed later (Req 18.2).
 * 2. Preferred track — 회화 (short), 독해 (long), or Both.
 *
 * On finish we persist the choices in useUserStore (AsyncStorage) and
 * stamp an anonymous UUID so later services have an identity to attach to.
 * Skipping login is the default path — Req 18.4 — and users can still
 * reach the login screen from the Me tab later.
 */

type Step = 'welcome' | 'track';
type TrackChoice = Track | 'both';

export default function OnboardingScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const [trackChoice, setTrackChoice] = useState<TrackChoice>('A');
  const [submitting, setSubmitting] = useState(false);

  const styles = makeStyles(theme);

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const anonymousId = await AuthService.signInAnonymouslyLocal();
      const state = useUserStore.getState();
      state.setAnonymousId(anonymousId);
      // 'both' defaults the main tab to Track A; the user can freely pick either.
      state.setPreferredTrack(trackChoice === 'both' ? 'A' : trackChoice);
      state.completeOnboarding();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {step === 'welcome' && (
        <WelcomeStep theme={theme} onContinue={() => setStep('track')} />
      )}
      {step === 'track' && (
        <TrackStep
          theme={theme}
          selected={trackChoice}
          onSelect={setTrackChoice}
          onBack={() => setStep('welcome')}
          submitting={submitting}
          onFinish={handleFinish}
        />
      )}
    </ScrollView>
  );
}

/* --------------------------------------------------------------- */

function WelcomeStep({ theme, onContinue }: { theme: Theme; onContinue: () => void }) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.step}>
      <Text style={styles.title}>SentenceFlow</Text>
      <Text style={styles.subtitle}>듣기 중심 영어. 발음 점수는 없어요.</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <Text style={styles.cardHeading}>발음을 평가하지 않아요.</Text>
        <Text style={styles.cardBody}>
          스피커를 누르면 원어민 음성이 몇 번이든 재생돼요. 소리 내어 따라 하거나, 속으로
          따라 해도 좋고, 그냥 듣기만 해도 괜찮아요. 다음 버튼은 언제든 누를 수 있어요.
        </Text>
      </View>
      <PrimaryButton theme={theme} label="계속" onPress={onContinue} />
    </View>
  );
}

function TrackStep({
  theme,
  selected,
  onSelect,
  onBack,
  submitting,
  onFinish,
}: {
  theme: Theme;
  selected: TrackChoice;
  onSelect: (value: TrackChoice) => void;
  onBack: () => void;
  submitting: boolean;
  onFinish: () => void;
}) {
  const styles = makeStyles(theme);
  const options: { value: TrackChoice; label: string; hint: string }[] = [
    { value: 'A', label: '회화', hint: '짧은 문장 패턴 + 드릴' },
    { value: 'B', label: '독해', hint: '긴 문장 청킹 + 독해' },
    { value: 'both', label: '둘 다', hint: '홈 탭에서 자유롭게 선택' },
  ];
  return (
    <View style={styles.step}>
      <Text style={styles.title}>어떻게 연습할까요?</Text>
      <Text style={styles.subtitle}>언제든 바꿀 수 있어요.</Text>
      <View style={{ gap: theme.spacing.sm }}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === opt.value }}
            accessibilityLabel={opt.label}
            style={[
              styles.optionRow,
              {
                borderColor: selected === opt.value ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected === opt.value ? theme.colors.surface : theme.colors.bg,
              },
            ]}
          >
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Text style={styles.optionHint}>{opt.hint}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.buttonRow}>
        <SecondaryButton theme={theme} label="이전" onPress={onBack} disabled={submitting} />
        <PrimaryButton
          theme={theme}
          label={submitting ? '준비 중…' : '학습 시작'}
          onPress={onFinish}
          disabled={submitting}
        />
      </View>
      <Text style={[styles.hintMuted, { textAlign: 'center' }]}>
        지금은 익명 모드로 사용 중이에요. 진도를 백업하려면 내 탭에서 계정을 만들어 주세요.
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- */

function PrimaryButton({
  theme,
  label,
  onPress,
  disabled,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.primary,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.md,
          alignItems: 'center',
        },
      ]}
    >
      <Text style={[theme.typography.button, { color: theme.colors.primaryOn }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  theme,
  label,
  onPress,
  disabled,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[theme.typography.button, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------------------------------------------- */

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.bg,
    },
    step: {
      flex: 1,
      gap: theme.spacing.md,
      paddingTop: theme.spacing.xl,
    },
    title: {
      ...theme.typography.heading,
      fontSize: 28,
      color: theme.colors.text,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
      marginBottom: theme.spacing.md,
    },
    card: {
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    cardHeading: {
      ...theme.typography.button,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    cardBody: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
    },
    optionRow: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    optionLabel: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    optionHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    hintMuted: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.md,
    },
  });
}
