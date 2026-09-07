// ljingleThemeColorUtilsV1
import { colors } from './colors';

function rgbFromHex(value: string) {
  const clean = value.trim().replace(/^#/, '');
  const expanded = clean.length === 3
    ? clean.split('').map((part) => part + part).join('')
    : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function linear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

// Theme-aware foreground for any user-selected accent/background.
// Returns palette tokens, never a hard-coded visual color.
export function themeInkOn(background: string) {
  const rgb = rgbFromHex(background);
  if (!rgb) return colors.text;

  const luminance =
    0.2126 * linear(rgb.r) +
    0.7152 * linear(rgb.g) +
    0.0722 * linear(rgb.b);

  return luminance > 0.48 ? colors.black : colors.white;
}

// Dynamic alpha from an existing theme token / active user color.
export function themeColorWithAlpha(color: string, alpha: number) {
  const rgb = rgbFromHex(color);
  if (!rgb) return color;
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${safeAlpha})`;
}
