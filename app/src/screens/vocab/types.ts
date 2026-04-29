/**
 * Vocab helper-specific JSON shapes. The Supabase `vocab_entries` table
 * stores these as jsonb; we keep a narrow TS mirror here so both the UI
 * and the Content Pipeline (Task 3 follow-up) agree on the contract.
 */

export type EtymologyPart = {
  text: string;
  meaning: string;
};

export type EtymologyPayload = {
  parts: EtymologyPart[];
  /** One-line human summary combining the parts. */
  gloss?: string;
  /** At most 5 words sharing the same root; rendered as swap targets. */
  related?: string[];
};

export type MnemonicPayload = {
  korean_phrase: string;
  story?: string;
};
