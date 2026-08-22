import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  loadLatelyStats,
  type LatelyPeriod,
  type LatelyStats,
} from '../storage/latelyStats';
import { colors } from '../theme/colors';

const activityLabels: Record<string, string> = {
  READING: 'Čitanje',
  WATCHING: 'Gledanje',
  STUDYING: 'Učenje',
  PLAYING: 'Igranje',
  RESEARCH: 'Istraživanje',
  WORK: 'Rad',
  EXERCISE: 'Vježbanje',
  CUSTOM: 'Ostalo',
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) {
    return hours + ' h ' + String(minutes).padStart(2, '0') + ' min';
  }

  return minutes + ' min';
}

function comparisonLabel(
  current: number,
  previous: number,
) {
  if (current === 0 && previous === 0) {
    return 'bez promjene';
  }

  if (previous === 0) {
    return current > 0
      ? 'novo u odnosu na prethodno razdoblje'
      : 'bez promjene';
  }

  const percent = Math.round(
    ((current - previous) / previous) * 100,
  );

  if (percent === 0) {
    return 'isto kao prethodno razdoblje';
  }

  return (
    (percent > 0 ? '+' : '') +
    percent +
    '% prema prethodnih ' +
    (current === previous ? '' : '')
  );
}

function StatTile({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {detail ? (
        <Text style={styles.tileDetail}>{detail}</Text>
      ) : null}
    </View>
  );
}

export function LatelyStatsSection() {
  const [period, setPeriod] =
    useState<LatelyPeriod>(30);

  const [data, setData] =
    useState<LatelyStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await loadLatelyStats(period));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Nedavna statistika nije dostupna.',
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>
            TVOJ TRENUTNI RITAM
          </Text>

          <Text style={styles.heading}>
            Interesi zadnje vrijeme?
          </Text>

          <Text style={styles.intro}>
            Uzorci iz stvarnih timera, zapisa i
            završenih stvari.
          </Text>
        </View>

        <View style={styles.periodSwitch}>
          {([30, 90] as LatelyPeriod[]).map(
            (option) => (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => setPeriod(option)}
                style={[
                  styles.periodButton,
                  period === option &&
                    styles.periodButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    period === option &&
                      styles.periodTextActive,
                  ]}
                >
                  {option} d
                </Text>
              </Pressable>
            ),
          )}
        </View>
      </View>

      {loading && !data ? (
        <View style={styles.state}>
          <ActivityIndicator
            color={colors.black}
            size="small"
          />
          <Text style={styles.stateText}>
            ?itam zadnjih {period} dana...
          </Text>
        </View>
      ) : error && !data ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={styles.errorState}
        >
          <Text style={styles.errorText}>
            {error}
          </Text>
          <Text style={styles.retryText}>
            Poku?aj ponovno
          </Text>
        </Pressable>
      ) : data ? (
        <>
          <View style={styles.grid}>
            <StatTile
              value={formatTime(data.trackedSeconds)}
              label="trackano vrijeme"
              detail={comparisonLabel(
                data.trackedSeconds,
                data.previousTrackedSeconds,
              )}
            />

            <StatTile
              value={String(data.sessionCount)}
              label="timer sessiona"
              detail={
                data.previousSessionCount +
                ' u prethodnom razdoblju'
              }
            />

            <StatTile
              value={String(data.entriesCreated)}
              label="novih zapisa"
              detail={
                data.previousEntriesCreated +
                ' u prethodnom razdoblju'
              }
            />

            <StatTile
              value={String(
                data.completedBooks +
                data.completedMovies +
                data.completedSeries +
                data.completedGames,
              )}
              label="završenih stvari"
              detail={
                data.completedMovies +
                ' filmova ? ' +
                data.completedSeries +
                ' serija ? ' +
                data.completedBooks +
                ' knjiga ? ' +
                data.completedGames +
                ' igara'
              }
            />
          </View>

          {data.topActivity ? (
            <View style={styles.focusCard}>
              <Text style={styles.focusLabel}>
                NAJVIŠE VREMENA
              </Text>

              <Text style={styles.focusTitle}>
                {data.topActivity.label}
              </Text>

              <Text style={styles.focusMeta}>
                {activityLabels[
                  data.topActivity.activityType
                ] ??
                  data.topActivity.activityType}
                {' ? '}
                {formatTime(
                  data.topActivity.seconds,
                )}
              </Text>
            </View>
          ) : null}

          {data.topTopic ? (
            <View style={styles.topicRow}>
              <View style={styles.topicMark} />

              <View style={styles.topicCopy}>
                <Text style={styles.focusLabel}>
                  TEMA KOJOJ SE VRA?A?
                </Text>

                <Text style={styles.topicTitle}>
                  {data.topTopic.name}
                </Text>

                <Text style={styles.topicMeta}>
                  {data.topTopic.signals}{' '}
                  povezanih tragova u zadnjih{' '}
                  {period} dana
                </Text>
              </View>
            </View>
          ) : null}

          {data.activityBreakdown.length > 0 ? (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownHeading}>
                Gdje odlazi vrijeme
              </Text>

              {data.activityBreakdown.map(
                (item, index) => {
                  const max =
                    data.activityBreakdown[0]
                      ?.seconds ?? 1;

                  const ratio =
                    max > 0
                      ? item.seconds / max
                      : 0;

                  return (
                    <View
                      key={item.activityType}
                      style={styles.breakdownRow}
                    >
                      <View style={styles.breakdownTop}>
                        <Text style={styles.breakdownName}>
                          {activityLabels[
                            item.activityType
                          ] ?? item.activityType}
                        </Text>

                        <Text style={styles.breakdownTime}>
                          {formatTime(item.seconds)}
                        </Text>
                      </View>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: ( // latelyStatsWidthTsFixV1
                                Math.max(
                                  5,
                                  Math.round(
                                    ratio * 100,
                                  ),
                                ) + '%') as import('react-native').DimensionValue,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                },
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 22,
  },

  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  headingCopy: {
    flex: 1,
    marginRight: 14,
  },

  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  heading: {
    marginTop: 6,
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  intro: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  periodSwitch: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: colors.fill,
    padding: 3,
  },

  periodButton: {
    minWidth: 48,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  periodButtonActive: {
    backgroundColor: colors.black,
  },

  periodText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },

  periodTextActive: {
    color: colors.white,
  },

  state: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.fill,
    padding: 16,
  },

  stateText: {
    marginLeft: 10,
    color: colors.textMuted,
    fontSize: 12,
  },

  errorState: {
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: colors.dangerSoft,
    padding: 16,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
  },

  retryText: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },

  grid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },

  tile: {
    width: '50%',
    paddingHorizontal: 5,
    marginBottom: 10,
  },

  tileValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  tileLabel: {
    marginTop: 3,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },

  tileDetail: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },

  focusCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: colors.fill,
    padding: 17,
  },

  focusLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  focusTitle: {
    marginTop: 6,
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },

  focusMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },

  topicRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingTop: 16,
  },

  topicMark: {
    width: 4,
    marginRight: 12,
    borderRadius: 999,
    backgroundColor: colors.black,
  },

  topicCopy: {
    flex: 1,
  },

  topicTitle: {
    marginTop: 5,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },

  topicMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
  },

  breakdown: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingTop: 17,
  },

  breakdownHeading: {
    marginBottom: 13,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },

  breakdownRow: {
    marginBottom: 12,
  },

  breakdownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  breakdownName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },

  breakdownTime: {
    color: colors.textMuted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },

  barTrack: {
    height: 6,
    marginTop: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.fillStrong,
  },

  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.black,
  },
});
