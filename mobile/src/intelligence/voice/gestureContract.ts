/**
 * K14 Bell gesture contract.
 *
 * This is intentionally declarative: the existing Bell interaction component
 * remains the owner of gesture recognition.
 *
 * TAP       -> command palette
 * HOLD      -> Home (existing behavior; DO NOT replace)
 * DRAG_UP   -> voice capture
 */
export type BellGestureAction = 'COMMAND_PALETTE' | 'HOME' | 'VOICE';

export const BELL_GESTURE_CONTRACT = {
  tap: 'COMMAND_PALETTE',
  hold: 'HOME',
  dragUp: 'VOICE',
} as const satisfies Record<string, BellGestureAction>;

export const VOICE_DRAG_THRESHOLD_PX = 44;
