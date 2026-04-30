/**
 * App 스모크 테스트.
 *
 * 네비게이터가 부팅되고 첫 화면에 온보딩이 뜨는지, 그리고 온보딩을
 * 마친 뒤 초기 상태가 RootTabs 로 전환되는지까지 고정한다. 두 번째
 * 케이스는 RootNavigator 가 `onboardingCompleted` 를
 * `initialRouteName` 이 아니라 **조건부 Screen 등록** 으로 감지하고
 * 있는지 지키는 회귀 가드다 (initialRouteName 으로 돌려 놓으면
 * 화면이 멈추는 UX 버그가 재현된다).
 *
 * AsyncStorage 는 jest.setup.ts 의 in-memory mock 을 쓰고 각 테스트
 * 앞에서 비우므로 기본값에서 시작한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';

import App from '../App';
import { useUserStore } from '../src/stores/useUserStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  // Zustand 인스턴스는 모듈 싱글톤이므로 이전 테스트의 상태가 살아
  // 있을 수 있다. 각 테스트 전에 깨끗하게 초기화한다.
  useUserStore.getState().reset();
});

describe('App', () => {
  it('첫 실행 시 온보딩 웰컴 스텝이 렌더된다', async () => {
    render(<App />);
    expect(await screen.findByText('SentenceFlow')).toBeOnTheScreen();
    expect(screen.getByText(/듣기 중심 영어/)).toBeOnTheScreen();
  });

  it('온보딩이 이미 완료된 상태라면 루트 탭으로 진입한다 (RootNavigator 조건부 등록 회귀 가드)', async () => {
    useUserStore.setState({ onboardingCompleted: true, hydrated: true });
    render(<App />);
    // Dashboard 의 고유 섹션 제목으로 RootTabs 마운트를 확인.
    // "홈" 은 헤더와 탭 바 두 곳에 동시에 뜨므로 식별자로 쓰기 어렵다.
    expect(await screen.findByText('오늘의 목표')).toBeOnTheScreen();
    expect(screen.getByText('학습 시작')).toBeOnTheScreen();
    // 온보딩 웰컴 문구는 이 경로에서 더 이상 존재하지 않아야 한다.
    expect(screen.queryByText(/듣기 중심 영어/)).toBeNull();
  });
});
