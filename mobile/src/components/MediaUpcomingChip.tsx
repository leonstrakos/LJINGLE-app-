// mediaUpcomingTvTimeR3
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { MediaUpcomingRelease } from '../services/mediaUpcomingApi';
import { activeAccentColor, colors } from '../theme/colors';

type Props = {
  release: MediaUpcomingRelease;
  compact?: boolean;
};

function dateParts(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function mediaUpcomingDaysUntil(
  value: string,
  now = new Date(),
) {
  const parts = dateParts(value);
  if (!parts) return null;

  const releaseDay = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
  );
  releaseDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return Math.round(
    (releaseDay.getTime() - today.getTime()) /
      86400000,
  );
}

function countdownLabel(days: number) {
  if (days === 0) return 'DANAS';
  if (days === 1) return 'SUTRA';
  if (days < 0) return null;
  return days === 1
    ? 'ZA 1 DAN'
    : `ZA ${days} DANA`;
}

function episodeCode(
  release: MediaUpcomingRelease,
) {
  if (
    release.seasonNumber == null ||
    release.episodeNumber == null
  ) {
    return 'NOVA EPIZODA';
  }

  return (
    'S' +
    String(release.seasonNumber).padStart(2, '0') +
    'E' +
    String(release.episodeNumber).padStart(2, '0')
  );
}

export function mediaUpcomingLabel(
  release: MediaUpcomingRelease,
  now = new Date(),
) {
  const days = mediaUpcomingDaysUntil(
    release.date,
    now,
  );
  if (days == null) return null;

  const countdown = countdownLabel(days);
  if (!countdown) return null;

  if (release.kind === 'EPISODE') {
    return `${episodeCode(release)} · ${countdown}`;
  }

  return `IZLAZI ${countdown}`;
}

export function MediaUpcomingChip({
  release,
  compact = false,
}: Props) {
  const label = mediaUpcomingLabel(release);
  if (!label) return null;

  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.chip,
        compact && styles.chipCompact,
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.text,
          compact && styles.textCompact,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  text: {
    flexShrink: 1,
    color: activeAccentColor,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
  textCompact: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.1,
  },
});
