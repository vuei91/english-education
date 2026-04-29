export {
  ContentService,
  type Sentence,
  type Chunk,
  type StructureSummary,
  type VocabEntry,
  type PatternDrill,
  type RecentTappedWord,
} from './ContentService';

export {
  parsePatternDrillVariants,
  PATTERN_DRILL_LEVELS,
  type PatternDrillLevel,
  type PatternDrillVariant,
  type PatternDrillVariants,
  type SlotHint,
  type SlotAgreement,
} from './patternDrill';

export {
  validateSlotSelection,
  validateAllSlots,
  type SlotSelection,
  type SlotValidation,
} from './slotValidation';
