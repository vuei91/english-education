/**
 * Smoke test: App renders the onboarding flow on a fresh install.
 * The real dashboard / session screens are exercised by their own tests;
 * here we only prove the navigator boots and lands on the expected
 * first-launch screen.
 *
 * useUserStore is persisted via AsyncStorage. AsyncStorage is mocked
 * in-memory (jest.setup.ts) and cleared per test, so `onboardingCompleted`
 * always starts at its default `false`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';

import App from '../App';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('App', () => {
  it('첫 실행 시 온보딩 웰컴 스텝이 렌더된다', async () => {
    render(<App />);
    // Zustand persist 는 비동기 rehydrate 이므로 findBy 로 기다린다.
    expect(await screen.findByText('SentenceFlow')).toBeOnTheScreen();
    // 웰컴 서브헤딩 — UI 한글화(localization-policy) 이후 문구.
    expect(screen.getByText(/듣기 중심 영어/)).toBeOnTheScreen();
  });
});
