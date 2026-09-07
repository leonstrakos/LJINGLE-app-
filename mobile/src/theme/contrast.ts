// ljingleCelestialContrastEngineR1
/**
 * Pure contrast math for LJingle.
 *
 * Uses WCAG relative luminance and contrast ratio.
 * This module does not know about visual skins or React Native.
 */

type Rgb = {
  red: number;
  green: number;
  blue: number;
};

const LIGHT_RGB: Rgb = {
  red: 255,
  green: 255,
  blue: 255,
};

const DARK_RGB: Rgb = {
  red: 0,
  green: 0,
  blue: 0,
};

const SOFT_LIGHT_RGB: Rgb = {
  red: 245,
  green: 245,
  blue: 247,
};

const SOFT_DARK_RGB: Rgb = {
  red: 24,
  green: 24,
  blue: 27,
};

function clampByte(
  value: number,
) {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(
        value,
      ),
    ),
  );
}

function byteHex(
  value: number,
) {
  return clampByte(
    value,
  )
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

function rgbToHex(
  rgb: Rgb,
) {
  return (
    '#' +
    byteHex(rgb.red) +
    byteHex(rgb.green) +
    byteHex(rgb.blue)
  );
}

function hexToRgb(
  value: string,
): Rgb {
  const normalized =
    value
      .trim()
      .replace(/^#/, '');

  if (
    !/^[0-9A-Fa-f]{6}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      'Contrast engine requires a 6-digit hex color.',
    );
  }

  return {
    red:
      Number.parseInt(
        normalized.slice(0, 2),
        16,
      ),
    green:
      Number.parseInt(
        normalized.slice(2, 4),
        16,
      ),
    blue:
      Number.parseInt(
        normalized.slice(4, 6),
        16,
      ),
  };
}

function srgbChannelToLinear(
  byte: number,
) {
  const channel =
    clampByte(byte) / 255;

  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow(
        (channel + 0.055) /
          1.055,
        2.4,
      );
}

function relativeLuminanceRgb(
  rgb: Rgb,
) {
  return (
    srgbChannelToLinear(
      rgb.red,
    ) *
      0.2126 +
    srgbChannelToLinear(
      rgb.green,
    ) *
      0.7152 +
    srgbChannelToLinear(
      rgb.blue,
    ) *
      0.0722
  );
}

export function relativeLuminance(
  color: string,
) {
  return relativeLuminanceRgb(
    hexToRgb(color),
  );
}

export function contrastRatio(
  first: string,
  second: string,
) {
  const firstLuminance =
    relativeLuminance(
      first,
    );

  const secondLuminance =
    relativeLuminance(
      second,
    );

  const lighter =
    Math.max(
      firstLuminance,
      secondLuminance,
    );

  const darker =
    Math.min(
      firstLuminance,
      secondLuminance,
    );

  return (
    (lighter + 0.05) /
    (darker + 0.05)
  );
}

function mixRgb(
  from: Rgb,
  to: Rgb,
  amount: number,
): Rgb {
  const safe =
    Math.max(
      0,
      Math.min(
        1,
        amount,
      ),
    );

  return {
    red:
      from.red +
      (to.red - from.red) *
        safe,
    green:
      from.green +
      (to.green - from.green) *
        safe,
    blue:
      from.blue +
      (to.blue - from.blue) *
        safe,
  };
}

function mixHex(
  from: string,
  to: Rgb,
  amount: number,
) {
  return rgbToHex(
    mixRgb(
      hexToRgb(from),
      to,
      amount,
    ),
  );
}

/**
 * Move a foreground toward one endpoint by the minimum amount needed
 * to reach target contrast.
 */
function minimumMixForContrast(
  foreground: string,
  background: string,
  endpoint: Rgb,
  targetRatio: number,
) {
  const endpointHex =
    rgbToHex(
      endpoint,
    );

  if (
    contrastRatio(
      endpointHex,
      background,
    ) < targetRatio
  ) {
    return null;
  }

  let low = 0;
  let high = 1;

  for (
    let index = 0;
    index < 24;
    index += 1
  ) {
    const middle =
      (low + high) / 2;

    const candidate =
      mixHex(
        foreground,
        endpoint,
        middle,
      );

    if (
      contrastRatio(
        candidate,
        background,
      ) >= targetRatio
    ) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return {
    amount: high,
    color:
      mixHex(
        foreground,
        endpoint,
        high,
      ),
  };
}

export function ensureContrast(
  foreground: string,
  background: string,
  targetRatio = 4.5,
) {
  if (
    contrastRatio(
      foreground,
      background,
    ) >= targetRatio
  ) {
    return foreground.toUpperCase();
  }

  const towardLight =
    minimumMixForContrast(
      foreground,
      background,
      LIGHT_RGB,
      targetRatio,
    );

  const towardDark =
    minimumMixForContrast(
      foreground,
      background,
      DARK_RGB,
      targetRatio,
    );

  if (
    towardLight &&
    towardDark
  ) {
    return (
      towardLight.amount <=
      towardDark.amount
        ? towardLight.color
        : towardDark.color
    );
  }

  if (
    towardLight
  ) {
    return towardLight.color;
  }

  if (
    towardDark
  ) {
    return towardDark.color;
  }

  const lightRatio =
    contrastRatio(
      rgbToHex(
        LIGHT_RGB,
      ),
      background,
    );

  const darkRatio =
    contrastRatio(
      rgbToHex(
        DARK_RGB,
      ),
      background,
    );

  return lightRatio >= darkRatio
    ? rgbToHex(
        LIGHT_RGB,
      )
    : rgbToHex(
        DARK_RGB,
      );
}

/**
 * Choose a neutral foreground by ACTUAL contrast, not a luminance cutoff.
 */
function neutralForeground(
  background: string,
) {
  const softLight =
    rgbToHex(
      SOFT_LIGHT_RGB,
    );

  const softDark =
    rgbToHex(
      SOFT_DARK_RGB,
    );

  const lightRatio =
    contrastRatio(
      softLight,
      background,
    );

  const darkRatio =
    contrastRatio(
      softDark,
      background,
    );

  const preferred =
    lightRatio >= darkRatio
      ? softLight
      : softDark;

  if (
    contrastRatio(
      preferred,
      background,
    ) >= 4.5
  ) {
    return preferred;
  }

  const pureLight =
    rgbToHex(
      LIGHT_RGB,
    );

  const pureDark =
    rgbToHex(
      DARK_RGB,
    );

  return (
    contrastRatio(
      pureLight,
      background,
    ) >=
    contrastRatio(
      pureDark,
      background,
    )
      ? pureLight
      : pureDark
  );
}

/**
 * Make secondary text quieter while still meeting a real contrast floor.
 */
function mutedForeground(
  text: string,
  background: string,
) {
  const backgroundRgb =
    hexToRgb(
      background,
    );

  let low = 0;
  let high = 1;

  for (
    let index = 0;
    index < 24;
    index += 1
  ) {
    const middle =
      (low + high) / 2;

    const candidate =
      mixHex(
        text,
        backgroundRgb,
        middle,
      );

    if (
      contrastRatio(
        candidate,
        background,
      ) >= 4.5
    ) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return mixHex(
    text,
    backgroundRgb,
    low,
  );
}

export function resolveContrastPalette(
  background: string,
  accent: string,
) {
  const text =
    neutralForeground(
      background,
    );

  const textMuted =
    mutedForeground(
      text,
      background,
    );

  const lightCandidate =
    rgbToHex(
      SOFT_LIGHT_RGB,
    );

  const darkCandidate =
    rgbToHex(
      SOFT_DARK_RGB,
    );

  const prefersLightForeground =
    contrastRatio(
      lightCandidate,
      background,
    ) >=
    contrastRatio(
      darkCandidate,
      background,
    );

  return {
    text,
    textMuted,

    // Small accent text/icons: normal-text contrast target.
    accentText:
      ensureContrast(
        accent,
        background,
        4.5,
      ),

    // Decorative stars/lines may be quieter but should not disappear.
    accentDecorative:
      ensureContrast(
        accent,
        background,
        3.0,
      ),

    // Text drawn ON an accent-filled control.
    // ljingleThemedOnAccentContrastR11
    // Preserve the selected two-color theme relationship first.
    // Example: Sparkle/Chrome background blue becomes ink on a white chip.
    onAccent:
      ensureContrast(
        background,
        accent,
        4.5,
      ),

    prefersLightForeground,

    backgroundLuminance:
      relativeLuminance(
        background,
      ),

    textContrast:
      contrastRatio(
        text,
        background,
      ),

    accentTextContrast:
      contrastRatio(
        ensureContrast(
          accent,
          background,
          4.5,
        ),
        background,
      ),
  } as const;
}
