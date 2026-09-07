// forkLCelestialFoundationV1
// forkLCelestialThemeBindingV1
import {
  activeAccentColor,
  activeBackgroundColor,
  colors,
  hexToRgb,
  rgbToHex,
  isDarkBackground,
} from './colors';
import { activeVisualSkinId } from './visualSkins';

import { resolveContrastPalette } from './contrast';
export const celestialEnabled =
  (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');

const BLACK = '#000000';
const WHITE = '#FFFFFF';

function mixHex(
  first: string,
  second: string,
  secondWeight: number,
) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const weight = Math.max(0, Math.min(1, secondWeight));

  return rgbToHex({
    red: a.red * (1 - weight) + b.red * weight,
    green: a.green * (1 - weight) + b.green * weight,
    blue: a.blue * (1 - weight) + b.blue * weight,
  });
}

function luminance(hex: string) {
  const { red, green, blue } = hexToRgb(hex);

  return (
    red * 0.2126 +
    green * 0.7152 +
    blue * 0.0722
  ) / 255;
}

export function celestialAlpha(
  hex: string,
  alpha: number,
) {
  const { red, green, blue } = hexToRgb(hex);
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  return `rgba(${red},${green},${blue},${safeAlpha})`;
}

/**
 * IMPORTANT:
 * The celestial palette is not locked.
 *
 * ThemePicker owns activeAccentColor + activeBackgroundColor.
 * Fresh install / "Vrati zadano" gives the canonical LJingle
 * midnight + gold preset. User colors override it everywhere.
 */
const accent = activeAccentColor;
const background = activeBackgroundColor;

// ljingleCelestialContrastEngineR1
const contrast =
  resolveContrastPalette(
    background,
    accent,
  );
const dark = isDarkBackground;

const accentLuminance = luminance(accent);

// ljingleCelestialAdaptiveContrastR1
// Readable accent foreground derived from the existing 0.48 dark/light cutoff.
// Raw accent is still preserved as celestial.gold for authored fills/borders.
const adaptiveAccent =
  dark
    ? (
        accentLuminance < 0.42
          ? mixHex(accent, WHITE, 0.38)
          : accent
      )
    : (
        accentLuminance > 0.42
          ? mixHex(accent, BLACK, 0.38)
          : accent
      );

export const celestial = {
  // User-owned ThemePicker values.
  night: background,
  nightSoft: colors.fill,
  nightRaised: colors.fillStrong,

  gold: accent,
  goldBright: mixHex(
    accent,
    accentLuminance < 0.62 ? WHITE : BLACK,
    0.20,
  ),
  goldDeep: mixHex(accent, BLACK, 0.24),
  goldInk: mixHex(accent, BLACK, 0.42),

  ivory: contrast.text,
  ivoryMuted: contrast.textMuted,
  celestialBlue: mixHex(background, accent, 0.16),

  star: adaptiveAccent,
  text: contrast.text,
  muted: contrast.textMuted,

  onAccent: contrast.onAccent,

  shadow: dark ? BLACK : mixHex(background, BLACK, 0.82),

  accentText: contrast.accentText,

  ornament: celestialAlpha(adaptiveAccent, dark ? 0.74 : 0.70),
  hairline: celestialAlpha(adaptiveAccent, dark ? 0.34 : 0.30),
  hairlineStrong: celestialAlpha(adaptiveAccent, dark ? 0.58 : 0.48),

  panel: celestialAlpha(colors.surface, dark ? 0.76 : 0.90),
  panelStrong: celestialAlpha(colors.fillStrong, dark ? 0.86 : 0.94),
  panelSoft: celestialAlpha(colors.fill, dark ? 0.34 : 0.42),

  goldWash: celestialAlpha(adaptiveAccent, dark ? 0.10 : 0.08),
  dither: celestialAlpha(adaptiveAccent, dark ? 0.25 : 0.16),

  radius: {
    small: 12,
    medium: 18,
    large: 26,
  },

  spacing: {
    hairline: 1,
    ornament: 8,
    section: 22,
  },
} as const;

export const celestialTypography = {
  eyebrow: {
    letterSpacing: 1.9,
    fontSize: 11,
    fontWeight: '800' as const,
  },
  section: {
    letterSpacing: -0.25,
    fontSize: 24,
    fontWeight: '800' as const,
  },
  meta: {
    letterSpacing: 0.7,
    fontSize: 11,
    fontWeight: '700' as const,
  },
} as const;
