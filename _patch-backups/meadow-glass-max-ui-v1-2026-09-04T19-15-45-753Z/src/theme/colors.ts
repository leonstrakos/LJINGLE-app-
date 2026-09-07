import { Platform } from 'react-native';
import { activeVisualSkinId } from './visualSkins';
import { getDatabaseConnection } from '../storage/databaseConnection';

const ACCENT_STORAGE_KEY = 'tracking_app_accent';
const BACKGROUND_STORAGE_KEY = 'tracking_app_background';
// forkN4CelestialDefaultPaletteV12
// forkLCelestialThemeBindingV1
const DEFAULT_ACCENT = '#D4AF55';
const DEFAULT_BACKGROUND = '#0B0F16';

export type RgbColor = { red: number; green: number; blue: number };

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
}

export function rgbToHex({ red, green, blue }: RgbColor) {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16).padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

export function hexToRgb(hex: string): RgbColor {
  const value = isHexColor(hex) ? hex.slice(1) : DEFAULT_ACCENT.slice(1);
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function hexToHsl(hex: string) {
  const { red, green, blue } = hexToRgb(hex);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }

  return {
    hue: (hue + 360) % 360,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
}

export function hslToHex(hue: number, saturation = 72, lightness = 48) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = ((hue % 360) + 360) % 360 / 60;
  const second = chroma * (1 - Math.abs((section % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (section < 1) [red, green] = [chroma, second];
  else if (section < 2) [red, green] = [second, chroma];
  else if (section < 3) [green, blue] = [chroma, second];
  else if (section < 4) [green, blue] = [second, chroma];
  else if (section < 5) [red, blue] = [second, chroma];
  else [red, blue] = [chroma, second];
  const match = l - chroma / 2;
  return rgbToHex({ red: (red + match) * 255, green: (green + match) * 255, blue: (blue + match) * 255 });
}

function mixHex(first: string, second: string, secondWeight: number) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const weight = Math.max(0, Math.min(1, secondWeight));
  return rgbToHex({
    red: a.red * (1 - weight) + b.red * weight,
    green: a.green * (1 - weight) + b.green * weight,
    blue: a.blue * (1 - weight) + b.blue * weight,
  });
}

function getSettingsDatabase() {
  const database = getDatabaseConnection() /* sqliteSingleConnectionV1 */;
  database.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY NOT NULL,
      setting_value TEXT NOT NULL
    );
  `);
  return database;
}

function readStoredBackground() {
  try {
    if (Platform.OS === 'web') {
      const stored = globalThis.localStorage?.getItem(BACKGROUND_STORAGE_KEY);
      return isHexColor(stored) ? stored.toUpperCase() : DEFAULT_BACKGROUND;
    }

    const row = getSettingsDatabase().getFirstSync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      BACKGROUND_STORAGE_KEY,
    );

    return isHexColor(row?.setting_value)
      ? row.setting_value.toUpperCase()
      : DEFAULT_BACKGROUND;
  } catch {
    return DEFAULT_BACKGROUND;
  }
}

function readStoredAccent() {
  try {
    if (Platform.OS === 'web') {
      const stored = globalThis.localStorage?.getItem(ACCENT_STORAGE_KEY);
      return isHexColor(stored) ? stored.toUpperCase() : DEFAULT_ACCENT;
    }
    const row = getSettingsDatabase().getFirstSync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?', ACCENT_STORAGE_KEY,
    );
    return isHexColor(row?.setting_value) ? row.setting_value.toUpperCase() : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function persistAccentColor(accent: string) {
  if (!isHexColor(accent)) throw new Error('Invalid accent color');
  const normalized = accent.toUpperCase();
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(ACCENT_STORAGE_KEY, normalized);
    return;
  }
  getSettingsDatabase().runSync(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    ACCENT_STORAGE_KEY, normalized,
  );
}

export function persistBackgroundColor(background: string) {
  if (!isHexColor(background)) throw new Error('Invalid background color');

  const normalized = background.toUpperCase();

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(BACKGROUND_STORAGE_KEY, normalized);
    return;
  }

  getSettingsDatabase().runSync(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    BACKGROUND_STORAGE_KEY,
    normalized,
  );
}

export const activeAccentColor = readStoredAccent();
export const activeBackgroundColor = readStoredBackground();
const pixelMode = activeVisualSkinId === 'pixel';
const aeroMode = activeVisualSkinId === 'aero';
const backgroundRgb = hexToRgb(activeBackgroundColor);
// forkKDarkBackgroundContrastV1
export const backgroundLuminance =
  (backgroundRgb.red * 0.2126 +
    backgroundRgb.green * 0.7152 +
    backgroundRgb.blue * 0.0722) / 255;

// FRUTIGER_AERO_MAX_UI_V2
export const DARK_BACKGROUND_LUMINANCE_THRESHOLD = 0.48;
export const isDarkBackground =
  !pixelMode &&
  !aeroMode &&
  backgroundLuminance < DARK_BACKGROUND_LUMINANCE_THRESHOLD;

const darkBackground = isDarkBackground;

// The Aero skin is authored rather than derived from the user's Classic accent.
// This keeps every screen coherent: bright sky, aquatic cyan, optimistic green,
// dark teal text, glossy white panels. Classic/Pixel retain their old behavior.
const aeroPalette = {
  background: '#BDEAF7',
  surface: 'rgba(255,255,255,0.78)',
  fill: 'rgba(225,247,252,0.74)',
  fillStrong: 'rgba(190,231,243,0.80)',
  border: 'rgba(255,255,255,0.94)',
  separator: 'rgba(38,126,163,0.24)',
  blue: '#0B88C8',
  blueDeep: '#075F91',
  blueSoft: 'rgba(111,211,240,0.38)',
  green: '#49AF4E',
  greenDeep: '#2B8740',
  greenSoft: 'rgba(184,236,157,0.60)',
  text: '#123F55',
  textMuted: '#527386',
  danger: '#D94B67',
  dangerSoft: 'rgba(255,235,240,0.82)',
} as const;

const background = pixelMode
  ? '#F7F7F2'
  : aeroMode
    ? aeroPalette.background
    : activeBackgroundColor;

const surface = pixelMode
  ? '#FFFFFF'
  : aeroMode
    ? aeroPalette.surface
    : darkBackground
      ? mixHex(activeBackgroundColor, '#FFFFFF', 0.08)
      : mixHex(activeBackgroundColor, '#FFFFFF', 0.72);

const fill = pixelMode
  ? '#ECECE5'
  : aeroMode
    ? aeroPalette.fill
    : darkBackground
      ? mixHex(activeBackgroundColor, '#FFFFFF', 0.12)
      : mixHex(activeBackgroundColor, '#FFFFFF', 0.48);

const fillStrong = pixelMode
  ? '#D8D8D0'
  : aeroMode
    ? aeroPalette.fillStrong
    : darkBackground
      ? mixHex(activeBackgroundColor, '#FFFFFF', 0.18)
      : mixHex(activeBackgroundColor, '#FFFFFF', 0.30);

const border = pixelMode
  ? '#111111'
  : aeroMode
    ? aeroPalette.border
    : darkBackground
      ? mixHex(activeBackgroundColor, '#FFFFFF', 0.24)
      : mixHex(activeBackgroundColor, '#000000', 0.11);

const accentSoft = pixelMode
  ? '#D8D8D0'
  : aeroMode
    ? aeroPalette.greenSoft
    : darkBackground
      ? mixHex(activeAccentColor, activeBackgroundColor, 0.72)
      : mixHex(activeAccentColor, '#FFFFFF', 0.82);

const text = pixelMode
  ? '#111111'
  : aeroMode
    ? aeroPalette.text
    : darkBackground
      ? '#F5F5F7'
      : activeAccentColor;

const textMuted = pixelMode
  ? '#3A3A3A'
  : aeroMode
    ? aeroPalette.textMuted
    : darkBackground
      ? '#A8A8AE'
      : '#6E6E73';

export const colors = {
  background,
  surface,
  navy: pixelMode ? '#111111' : aeroMode ? aeroPalette.blueDeep : activeAccentColor,
  navySoft: pixelMode ? '#111111' : aeroMode ? aeroPalette.blue : activeAccentColor,
  gold: pixelMode ? '#111111' : aeroMode ? aeroPalette.green : activeAccentColor,
  goldSoft: accentSoft,
  cream: surface,
  text,
  textMuted,
  border,
  success: pixelMode ? '#111111' : aeroMode ? aeroPalette.green : activeAccentColor,
  successSoft: aeroMode ? aeroPalette.greenSoft : accentSoft,
  danger: pixelMode ? '#111111' : aeroMode ? aeroPalette.danger : '#D70015',
  dangerSoft: pixelMode ? '#ECECE5' : aeroMode ? aeroPalette.dangerSoft : '#FFF0F1',
  white: '#FFFFFF',
  black: pixelMode ? '#111111' : aeroMode ? aeroPalette.blueDeep : activeAccentColor,
  fill,
  fillStrong,
  separator: aeroMode ? aeroPalette.separator : border,
};

const classicActivityAccent = { background: accentSoft, foreground: activeAccentColor };
const pixelActivityAccent = { background: '#ECECE5', foreground: '#111111' };

export const activityAccents = {
  READING: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(204,242,175,0.78)', foreground: '#2B8740' }
    : classicActivityAccent,
  WATCHING: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(181,231,250,0.82)', foreground: '#087CB8' }
    : classicActivityAccent,
  STUDYING: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(222,215,250,0.78)', foreground: '#6555A8' }
    : classicActivityAccent,
  PLAYING: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(255,227,171,0.80)', foreground: '#A56B12' }
    : classicActivityAccent,
  RESEARCH: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(187,242,228,0.82)', foreground: '#21806B' }
    : classicActivityAccent,
  WORK: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(205,229,250,0.82)', foreground: '#3A6E9B' }
    : classicActivityAccent,
  EXERCISE: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(255,205,204,0.80)', foreground: '#B34B4B' }
    : classicActivityAccent,
  CUSTOM: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(224,242,247,0.82)', foreground: '#39768C' }
    : classicActivityAccent,
  GLOBAL: pixelMode ? pixelActivityAccent : aeroMode
    ? { background: 'rgba(181,231,250,0.82)', foreground: '#087CB8' }
    : classicActivityAccent,
} as const;
