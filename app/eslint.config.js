// ESLint 9 flat config for Expo + TypeScript + Prettier
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

// ---------------------------------------------------------------------------
// No-microphone / No-STT lint rule (Req 7.5 + product-context Non-Goals)
//
// This project's first unbreakable product rule is "the app never accesses
// the user's microphone and never evaluates user speech." We enforce that
// at the import / syntax level so a contributor can't accidentally pull in
// a recording or speech-recognition API without the lint stage catching it.
//
// The rule itself is the test: renaming any of the forbidden packages /
// APIs into a real source file under app/ will trip `eslint .`. We do NOT
// ship a .skip fixture — the matrix below is small and purely declarative.
//
// If a legitimate future feature needs one of these APIs, the correct fix
// is NOT to silence the rule locally. Bring it up against the spec
// (requirements.md Req 7.5) and product-context.md Non-Goals first.
// ---------------------------------------------------------------------------
const NO_MIC_MESSAGE =
  'No microphone / STT — Req 7.5 & product-context.md Non-Goals. ' +
  'Use text input, pre-generated audio via AudioService, or expo-speech TTS fallback instead.';

const noMicImportsRule = {
  paths: [
    {
      name: '@react-native-voice/voice',
      message: NO_MIC_MESSAGE,
    },
    {
      name: 'react-native-voice',
      message: NO_MIC_MESSAGE,
    },
    {
      name: 'expo-speech-recognition',
      message: NO_MIC_MESSAGE,
    },
    {
      name: 'react-native-recordio',
      message: NO_MIC_MESSAGE,
    },
    // expo-audio: block recording surface, keep playback surface usable.
    {
      name: 'expo-audio',
      importNames: [
        'AudioRecorder',
        'useAudioRecorder',
        'Recording',
        'RecordingOptions',
      ],
      message: NO_MIC_MESSAGE,
    },
    // expo-av: block the Recording export entirely. We don't ship expo-av
    // today; this rule exists so a future regression (someone installing
    // it to pick up Audio.Recording) is caught at the import line.
    {
      name: 'expo-av',
      importNames: ['Recording', 'Audio'],
      message:
        NO_MIC_MESSAGE +
        ' expo-av.Audio.Recording is the common backdoor; if you only need playback, import from expo-audio instead.',
    },
  ],
  patterns: [
    {
      group: ['*speech-recognition*', '*speech-to-text*'],
      message: NO_MIC_MESSAGE,
    },
  ],
};

const noMicSyntaxRule = [
  {
    // navigator.mediaDevices.getUserMedia(...) — covers the web/RNW path
    // where a contributor might reach for the Web API directly.
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.property.name='getUserMedia']",
    message: NO_MIC_MESSAGE,
  },
  {
    // expo-av's historical entry point: `Audio.Recording`, either as
    // `new Audio.Recording()` or `Audio.Recording.createAsync(...)`.
    // Caught even if `Audio` itself survived the import-level rule
    // (e.g. via `import * as AV from 'expo-av'` → `AV.Audio.Recording`).
    selector:
      "MemberExpression[property.name='Recording'][object.name='Audio']",
    message: NO_MIC_MESSAGE,
  },
];

module.exports = [
  ...expoConfig,
  prettier,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Applies to every lintable source file in the project. Tests are
    // intentionally NOT excluded — guard tests may reference the tokens
    // as string literals, which is fine; the rules below only trigger on
    // real import statements or call expressions.
    rules: {
      'no-restricted-imports': ['error', noMicImportsRule],
      'no-restricted-syntax': ['error', ...noMicSyntaxRule],
    },
  },
];
