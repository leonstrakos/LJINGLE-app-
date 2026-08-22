import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { activeVisualSkinId } from './visualSkins';

const ACCENT_STORAGE_KEY = 'tracking_app_accent';
const BACKGROUND_STORAGE_KEY = 'tracking_app_background';
const DATABASE_NAME = 'life_catalogue.db';
const DEFAULT_ACCENT = '#1D1D1F';
const DEFAULT_BACKGROUND = '#F1F1F2';

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
  const database = SQLite.openDatabaseSync(DATABASE_NAME);
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
const backgroundLuminance =
  (backgroundRgb.red * 0.2126 +
    backgroundRgb.green * 0.7152 +
    backgroundRgb.blue * 0.0722) / 255;

const darkBackground = !pixelMode && backgroundLuminance < 0.48;

const background = pixelMode ? '#F7F7F2' : activeBackgroundColor;

const surface = pixelMode
  ? '#FFFFFF'
  : darkBackground
    ? mixHex(activeBackgroundColor, '#FFFFFF', 0.08)
    : mixHex(activeBackgroundColor, '#FFFFFF', 0.72);

const fill = pixelMode
  ? '#ECECE5'
  : darkBackground
    ? mixHex(activeBackgroundColor, '#FFFFFF', 0.12)
    : mixHex(activeBackgroundColor, '#FFFFFF', 0.48);

const fillStrong = pixelMode
  ? '#D8D8D0'
  : darkBackground
    ? mixHex(activeBackgroundColor, '#FFFFFF', 0.18)
    : mixHex(activeBackgroundColor, '#FFFFFF', 0.30);

const border = pixelMode
  ? '#111111'
  : darkBackground
    ? mixHex(activeBackgroundColor, '#FFFFFF', 0.24)
    : mixHex(activeBackgroundColor, '#000000', 0.11);

const accentSoft = pixelMode
  ? '#D8D8D0'
  : darkBackground
    ? mixHex(activeAccentColor, activeBackgroundColor, 0.72)
    : mixHex(activeAccentColor, '#FFFFFF', 0.82);

const text = darkBackground ? '#F5F5F7' : '#1D1D1F';
const textMuted = pixelMode
  ? '#3A3A3A'
  : darkBackground
    ? '#A8A8AE'
    : '#6E6E73';

export const colors = {
  background,
  surface,
  navy: pixelMode ? '#111111' : activeAccentColor,
  navySoft: pixelMode ? '#111111' : activeAccentColor,
  gold: pixelMode ? '#111111' : activeAccentColor,
  goldSoft: accentSoft,
  cream: surface,
  text,
  textMuted,
  border,
  success: pixelMode ? '#111111' : activeAccentColor,
  successSoft: accentSoft,
  danger: pixelMode ? '#111111' : '#D70015',
  dangerSoft: pixelMode ? '#ECECE5' : '#FFF0F1',
  white: '#FFFFFF',
  black: pixelMode ? '#111111' : activeAccentColor,
  fill,
  fillStrong,
  separator: border,
};

const activityAccent = pixelMode
  ? { background: '#ECECE5', foreground: '#111111' }
  : aeroMode
    ? { background: 'rgba(232,250,255,0.82)', foreground: '#087D99' }
    : { background: accentSoft, foreground: activeAccentColor };

export const activityAccents = {
  READING: activityAccent,
  WATCHING: activityAccent,
  STUDYING: activityAccent,
  PLAYING: activityAccent,
  RESEARCH: activityAccent,
  WORK: activityAccent,
  EXERCISE: activityAccent,
  CUSTOM: activityAccent,
} as const;
