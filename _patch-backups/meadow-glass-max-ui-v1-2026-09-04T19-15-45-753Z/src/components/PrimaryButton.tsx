// forkLCelestialFoundationV1
import {
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import {
  celestial,
  celestialEnabled,
} from '../theme/celestial';
import { AnimatedPressable } from './AnimatedPressable';

const aeroMode = activeVisualSkinId === 'aero';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const isDisabled = disabled || loading;

  const loaderColor =
    celestialEnabled && variant === 'primary'
      ? celestial.ivory
      : variant === 'primary'
        ? colors.white
        : variant === 'danger'
          ? colors.danger
          : celestialEnabled
            ? celestial.accentText
            : colors.black;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      cue={false}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.button,
        styles[variant],
        aeroMode && styles.aeroButton,
        aeroMode && variant === 'primary' && styles.aeroPrimary,
        aeroMode && variant === 'secondary' && styles.aeroSecondary,
        aeroMode && variant === 'danger' && styles.aeroDanger,
        celestialEnabled && styles.celestialButton,
        celestialEnabled &&
          variant === 'primary' &&
          styles.celestialPrimary,
        celestialEnabled &&
          variant === 'secondary' &&
          styles.celestialSecondary,
        celestialEnabled &&
          variant === 'danger' &&
          styles.celestialDanger,
        isDisabled && styles.disabled,
      ]}
      pressedStyle={!isDisabled ? styles.pressed : undefined}
    >
      {aeroMode ? <Text pointerEvents="none" style={styles.aeroShine}>◌</Text> : null}
      {loading ? (
        <ActivityIndicator color={loaderColor} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'danger' && styles.dangerLabel,
            celestialEnabled && styles.celestialLabel,
            celestialEnabled &&
              variant === 'primary' &&
              styles.celestialPrimaryLabel,
            celestialEnabled &&
              variant === 'secondary' &&
              styles.celestialSecondaryLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: colors.black,
  },
  secondary: {
    backgroundColor: colors.fillStrong,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: colors.black,
  },
  dangerLabel: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.55,
  },

  aeroButton: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#087CB8',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 4,
  },
  aeroPrimary: { backgroundColor: '#0B88C8' },
  aeroSecondary: { backgroundColor: 'rgba(255,255,255,0.74)' },
  aeroDanger: { backgroundColor: 'rgba(255,241,245,0.84)' },
  aeroShine: {
    position: 'absolute',
    top: -14,
    right: 8,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 46,
    lineHeight: 52,
  },
  celestialButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: celestial.hairlineStrong,
  },
  celestialPrimary: {
    backgroundColor: celestial.night,
    borderColor: celestial.goldDeep,
  },
  celestialSecondary: {
    backgroundColor: celestial.goldWash,
    borderColor: celestial.hairlineStrong,
  },
  celestialDanger: {
    backgroundColor: celestial.panelStrong,
  },
  celestialLabel: {
    letterSpacing: 0.45,
  },
  celestialPrimaryLabel: {
    color: celestial.ivory,
  },
  celestialSecondaryLabel: {
    color: celestial.accentText,
  },
});
