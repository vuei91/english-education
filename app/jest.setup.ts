/**
 * Jest setup.
 *
 * Native modules used by React Navigation don't render under the test
 * renderer out of the box. These mocks mirror the recommendations in
 * https://reactnavigation.org/docs/testing/ so children actually appear
 * in the rendered tree.
 *
 * AsyncStorage ships its own Jest mock that must be registered before any
 * module tries to import it.
 * See https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
 *
 * expo-sqlite and expo-speech require native modules that Jest cannot
 * resolve. We mock them with lightweight stand-ins; real database and
 * playback behaviour is covered by targeted unit tests that inject fakes
 * directly.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => cb()),
    closeAsync: jest.fn(async () => undefined),
  })),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => undefined),
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    setPlaybackRate: jest.fn(),
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return {
    ...actual,
    enableScreens: jest.fn(),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const React = require('react');
  const { View } = require('react-native');

  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };

  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaConsumer: ({ children }: { children: (i: typeof insets) => React.ReactNode }) =>
      children(insets),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});

export {};
