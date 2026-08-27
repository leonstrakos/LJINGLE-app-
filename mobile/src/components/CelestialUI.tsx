// forkLCelestialFoundationV1
import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  celestial,
  celestialEnabled,
  celestialTypography,
} from '../theme/celestial';

type PanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  ornament?: boolean;
};

export function CelestialPanel({
  children,
  style,
  ornament = true,
}: PanelProps) {
  return (
    <View
      style={[
        styles.panelBase,
        celestialEnabled && styles.panelCelestial,
        style,
      ]}
    >
      {celestialEnabled && ornament ? (
        <>
          <Text pointerEvents="none" style={styles.cornerStarLeft}>
            ✦
          </Text>
          <Text pointerEvents="none" style={styles.cornerStarRight}>
            ✧
          </Text>
          <View pointerEvents="none" style={styles.panelTopRule} />
        </>
      ) : null}
      {children}
    </View>
  );
}

type GlyphBadgeProps = {
  glyph: string;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
};

export function GlyphBadge({
  glyph,
  size = 'medium',
  style,
}: GlyphBadgeProps) {
  return (
    <View
      style={[
        styles.glyphBadge,
        styles[
          size === 'small'
            ? 'glyphBadgeSmall'
            : size === 'large'
              ? 'glyphBadgeLarge'
              : 'glyphBadgeMedium'
        ],
        celestialEnabled && styles.glyphBadgeCelestial,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.glyphText,
          size === 'small' && styles.glyphTextSmall,
          size === 'large' && styles.glyphTextLarge,
          celestialEnabled && styles.glyphTextCelestial,
        ]}
      >
        {glyph}
      </Text>
    </View>
  );
}

type StarDividerProps = {
  label?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StarDivider({
  label,
  compact = false,
  style,
}: StarDividerProps) {
  if (!celestialEnabled) {
    return (
      <View
        style={[
          styles.plainDivider,
          compact && styles.dividerCompact,
          style,
        ]}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.dividerRow,
        compact && styles.dividerCompact,
        style,
      ]}
    >
      <View style={styles.dividerLine} />
      <Text style={styles.dividerStar}>✦</Text>
      {label ? (
        <Text numberOfLines={1} style={styles.dividerLabel}>
          {label}
        </Text>
      ) : (
        <Text style={styles.dividerTinyStar}>✧</Text>
      )}
      <Text style={styles.dividerStar}>✦</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

type EyebrowProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

export function CelestialEyebrow({
  children,
  style,
}: EyebrowProps) {
  return (
    <Text
      style={[
        styles.eyebrow,
        celestialEnabled && styles.eyebrowCelestial,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  glyph?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CelestialSectionHeading({
  title,
  eyebrow,
  glyph = '✦',
  trailing,
  style,
}: SectionHeadingProps) {
  return (
    <View style={[styles.sectionHeading, style]}>
      <View style={styles.sectionCopy}>
        {eyebrow ? (
          <CelestialEyebrow>{eyebrow}</CelestialEyebrow>
        ) : null}
        <View style={styles.sectionTitleRow}>
          {celestialEnabled ? (
            <Text style={styles.sectionGlyph}>{glyph}</Text>
          ) : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      {trailing ? (
        <View style={styles.sectionTrailing}>{trailing}</View>
      ) : null}
    </View>
  );
}

type EmptyMarkProps = {
  glyph?: string;
  label?: string;
};

export function CelestialEmptyMark({
  glyph = '✧',
  label,
}: EmptyMarkProps) {
  return (
    <View style={styles.emptyMarkWrap}>
      <GlyphBadge glyph={glyph} size="large" />
      {label ? (
        <Text style={styles.emptyMarkLabel}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panelBase: {
    position: 'relative',
  },
  panelCelestial: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: celestial.hairline,
    backgroundColor: celestial.panel,
  },
  panelTopRule: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: StyleSheet.hairlineWidth,
    backgroundColor: celestial.hairlineStrong,
    opacity: 0.7,
  },
  cornerStarLeft: {
    position: 'absolute',
    top: 8,
    left: 10,
    color: celestial.ornament,
    fontSize: 8,
    lineHeight: 10,
    zIndex: 1,
  },
  cornerStarRight: {
    position: 'absolute',
    top: 8,
    right: 10,
    color: celestial.ornament,
    fontSize: 8,
    lineHeight: 10,
    zIndex: 1,
  },

  glyphBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphBadgeSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  glyphBadgeMedium: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  glyphBadgeLarge: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  glyphBadgeCelestial: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: celestial.hairlineStrong,
    backgroundColor: celestial.goldWash,
  },
  glyphText: {
    color: celestial.text,
    fontSize: 20,
    textAlign: 'center',
  },
  glyphTextSmall: {
    fontSize: 15,
  },
  glyphTextLarge: {
    fontSize: 27,
  },
  glyphTextCelestial: {
    color: celestial.accentText,
  },

  plainDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: celestial.hairline,
    marginVertical: 14,
  },
  dividerRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 14,
  },
  dividerCompact: {
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: celestial.hairline,
  },
  dividerStar: {
    color: celestial.ornament,
    fontSize: 9,
    lineHeight: 12,
  },
  dividerTinyStar: {
    color: celestial.ornament,
    fontSize: 7,
    lineHeight: 10,
    opacity: 0.82,
  },
  dividerLabel: {
    maxWidth: '62%',
    color: celestial.accentText,
    ...celestialTypography.meta,
    textTransform: 'uppercase',
  },

  eyebrow: {
    color: celestial.muted,
    ...celestialTypography.eyebrow,
    textTransform: 'uppercase',
  },
  eyebrowCelestial: {
    color: celestial.accentText,
  },

  sectionHeading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitleRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionGlyph: {
    color: celestial.ornament,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    flexShrink: 1,
    color: celestial.text,
    ...celestialTypography.section,
  },
  sectionTrailing: {
    flexShrink: 0,
  },

  emptyMarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyMarkLabel: {
    color: celestial.muted,
    ...celestialTypography.meta,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
