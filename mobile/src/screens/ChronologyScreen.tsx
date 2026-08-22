import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  buildSeasonalMemories,
  groupChronologyByYear,
  loadChronology,
} from '../storage/chronology';

import { colors } from '../theme/colors';

import type {
  ChronologyEvent,
  ChronologyZoom,
} from '../types/chronology';

// chronologyV1

const zoomLabels:
  Record<ChronologyZoom, string> = {
    YEARS: 'GODINE',
    MONTHS: 'MJESECI',
    DAYS: 'DANI',
  };

const eventLabels:
  Record<
    ChronologyEvent['kind'],
    string
  > = {
    SESSION: 'SESIJA',
    ENTRY: 'ZAPIS',
    BOOK_STARTED: 'POEO ITATI',
    BOOK_FINISHED: 'PROITAO',
    MEDIA_STARTED: 'POEO GLEDATI',
    MEDIA_COMPLETED: 'POGLEDAO',
    GAME_STARTED: 'POEO IGRATI',
    GAME_FINISHED: 'ZAVRIO',
  };

const eventMarks:
  Record<
    ChronologyEvent['kind'],
    string
  > = {
    SESSION: '●',
    ENTRY: '≡',
    BOOK_STARTED: '→',
    BOOK_FINISHED: '✓',
    MEDIA_STARTED: '→',
    MEDIA_COMPLETED: '✓',
    GAME_STARTED: '→',
    GAME_FINISHED: '✓',
  };

function parseEventDate(
  value: string,
) {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value + 'T12:00:00'
      : value,
  );
}

function durationLabel(seconds: number) {
  if (seconds < 60) {
    return '< 1 min';
  }

  const minutes =
    Math.floor(seconds / 60);

  const hours =
    Math.floor(minutes / 60);

  const remainder =
    minutes % 60;

  if (!hours) {
    return minutes + ' min';
  }

  return remainder
    ? hours + ' h ' + remainder + ' min'
    : hours + ' h';
}

function dateLabel(value: string) {
  const date = parseEventDate(value);

  return date.toLocaleDateString(
    'hr-HR',
    {
      day: 'numeric',
      month: 'short',
    },
  );
}

function timeLabel(value: string) {
  if (
    !value.includes('T') &&
    !value.includes(':')
  ) {
    return null;
  }

  const date = parseEventDate(value);

  return date.toLocaleTimeString(
    'hr-HR',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function EventRow({
  event,
}: {
  event: ChronologyEvent;
}) {
  const time = timeLabel(event.at);

  return (
    <View style={styles.event}>
      <View style={styles.eventRail}>
        <Text style={styles.eventMark}>
          {eventMarks[event.kind]}
        </Text>
      </View>

      <View style={styles.eventBody}>
        <View style={styles.eventTop}>
          <Text style={styles.eventKind}>
            {eventLabels[event.kind]}
          </Text>

          <Text style={styles.eventDate}>
            {dateLabel(event.at)}
            {time ? ' · ' + time : ''}
          </Text>
        </View>

        <Text style={styles.eventTitle}>
          {event.title}
        </Text>

        {event.subtitle ? (
          <Text
            numberOfLines={2}
            style={styles.eventSubtitle}
          >
            {event.subtitle}
          </Text>
        ) : null}

        {event.kind === 'SESSION' &&
        event.durationSeconds !== null ? (
          <Text style={styles.eventMeta}>
            {durationLabel(
              event.durationSeconds,
            )}
          </Text>
        ) : null}

        {event.kind === 'ENTRY' &&
        event.note ? (
          <Text
            numberOfLines={3}
            style={styles.entryPreview}
          >
            {event.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ChronologyScreen() {
  const [events, setEvents] =
    useState<ChronologyEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [zoom, setZoom] =
    useState<ChronologyZoom>('MONTHS');

  const years =
    useMemo(
      () => groupChronologyByYear(events),
      [events],
    );

  const [selectedYear, setSelectedYear] =
    useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    void loadChronology()
      .then((result) => {
        if (cancelled) return;

        setEvents(result);
      })
      .catch((caught) => {
        if (cancelled) return;

        setError(
          caught instanceof Error
            ? caught.message
            : 'Kronologija se nije mogla učitati.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      selectedYear === null &&
      years.length
    ) {
      setSelectedYear(years[0].year);
    }
  }, [selectedYear, years]);

  const activeYear =
    years.find(
      (year) =>
        year.year === selectedYear,
    ) ?? years[0];

  const seasonal =
    useMemo(
      () =>
        buildSeasonalMemories(
          events,
          new Date(),
          14,
        ),
      [events],
    );

  const days =
    useMemo(() => {
      if (!activeYear) return [];

      const map =
        new Map<
          string,
          ChronologyEvent[]
        >();

      for (const month of activeYear.months) {
        for (const event of month.events) {
          const date =
            parseEventDate(event.at);

          const key = [
            date.getFullYear(),
            String(
              date.getMonth() + 1,
            ).padStart(2, '0'),
            String(
              date.getDate(),
            ).padStart(2, '0'),
          ].join('-');

          const current =
            map.get(key) ?? [];

          current.push(event);
          map.set(key, current);
        }
      }

      return [...map.entries()]
        .sort(([a], [b]) =>
          b.localeCompare(a),
        );
    }, [activeYear]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>
            Slažem osobnu kronologiju…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            Kronologija nije dostupna
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <Text style={styles.kicker}>
          OSOBNI ARHIV
        </Text>

        <Text style={styles.title}>
          Kronologija
        </Text>

        <Text style={styles.copy}>
          Ne samo što si spremio, nego kada je
          nešto bilo dio tvog života.
        </Text>

        <View style={styles.zoom}>
          {(
            Object.keys(
              zoomLabels,
            ) as ChronologyZoom[]
          ).map((item) => (
            <Pressable
              key={item}
              onPress={() =>
                setZoom(item)
              }
              style={[
                styles.zoomButton,
                zoom === item &&
                  styles.zoomButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.zoomText,
                  zoom === item &&
                    styles.zoomTextActive,
                ]}
              >
                {zoomLabels[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        {seasonal.length ? (
          <View style={styles.seasonalCard}>
            <Text style={styles.sectionKicker}>
              OKO OVOG DATUMA
            </Text>

            <Text style={styles.sectionTitle}>
              U ovo doba…
            </Text>

            {seasonal
              .slice(0, 3)
              .map((group) => (
                <View
                  key={group.year}
                  style={styles.seasonalYear}
                >
                  <Text
                    style={
                      styles.seasonalYearLabel
                    }
                  >
                    {group.year}
                  </Text>

                  <View
                    style={
                      styles.seasonalEvents
                    }
                  >
                    {group.events
                      .slice(0, 3)
                      .map((event) => (
                        <View
                          key={event.id}
                          style={
                            styles.seasonalLine
                          }
                        >
                          <Text
                            style={
                              styles.seasonalMark
                            }
                          >
                            {
                              eventMarks[
                                event.kind
                              ]
                            }
                          </Text>

                          <Text
                            numberOfLines={1}
                            style={
                              styles.seasonalText
                            }
                          >
                            {event.title}
                          </Text>
                        </View>
                      ))}

                    {group.eventCount > 3 ? (
                      <Text
                        style={
                          styles.moreText
                        }
                      >
                        +{' '}
                        {group.eventCount -
                          3}{' '}
                        još
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
          </View>
        ) : null}

        {!years.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Arhiv tek počinje
            </Text>

            <Text style={styles.emptyCopy}>
              Sesije, zapisi te početci i završeci
              sadržaja pojavit će se ovdje čim
              imaju stvarni datum.
            </Text>
          </View>
        ) : null}

        {zoom === 'YEARS' ? (
          <View style={styles.yearGrid}>
            {years.map((year) => (
              <Pressable
                key={year.year}
                onPress={() => {
                  setSelectedYear(
                    year.year,
                  );
                  setZoom('MONTHS');
                }}
                style={styles.yearCard}
              >
                <Text style={styles.yearNumber}>
                  {year.year}
                </Text>

                <Text style={styles.yearMeta}>
                  {year.eventCount}{' '}
                  događaja
                </Text>

                {year.trackedSeconds >
                0 ? (
                  <Text
                    style={
                      styles.yearTime
                    }
                  >
                    {durationLabel(
                      year.trackedSeconds,
                    )}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {zoom !== 'YEARS' &&
        activeYear ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.yearPicker
              }
            >
              {years.map((year) => (
                <Pressable
                  key={year.year}
                  onPress={() =>
                    setSelectedYear(
                      year.year,
                    )
                  }
                  style={[
                    styles.yearPill,
                    year.year ===
                      activeYear.year &&
                      styles.yearPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.yearPillText,
                      year.year ===
                        activeYear.year &&
                        styles.yearPillTextActive,
                    ]}
                  >
                    {year.year}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {zoom === 'MONTHS'
              ? activeYear.months.map(
                  (month) => (
                    <View
                      key={month.key}
                      style={styles.month}
                    >
                      <View
                        style={
                          styles.monthHeading
                        }
                      >
                        <View>
                          <Text
                            style={
                              styles.monthName
                            }
                          >
                            {month.label}
                          </Text>

                          <Text
                            style={
                              styles.monthMeta
                            }
                          >
                            {
                              month.eventCount
                            }{' '}
                            događaja
                            {month.trackedSeconds
                              ? ' · ' +
                                durationLabel(
                                  month.trackedSeconds,
                                )
                              : ''}
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.monthYear
                          }
                        >
                          {month.year}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.timeline
                        }
                      >
                        {month.events.map(
                          (event) => (
                            <EventRow
                              key={
                                event.id
                              }
                              event={
                                event
                              }
                            />
                          ),
                        )}
                      </View>
                    </View>
                  ),
                )
              : null}

            {zoom === 'DAYS'
              ? days.map(
                  ([day, dayEvents]) => (
                    <View
                      key={day}
                      style={styles.month}
                    >
                      <View
                        style={
                          styles.monthHeading
                        }
                      >
                        <View>
                          <Text
                            style={
                              styles.dayName
                            }
                          >
                            {new Date(
                              day +
                                'T12:00:00',
                            ).toLocaleDateString(
                              'hr-HR',
                              {
                                weekday:
                                  'long',
                                day: 'numeric',
                                month:
                                  'long',
                              },
                            )}
                          </Text>

                          <Text
                            style={
                              styles.monthMeta
                            }
                          >
                            {
                              dayEvents.length
                            }{' '}
                            događaja
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.timeline
                        }
                      >
                        {dayEvents.map(
                          (event) => (
                            <EventRow
                              key={
                                event.id
                              }
                              event={
                                event
                              }
                            />
                          ),
                        )}
                      </View>
                    </View>
                  ),
                )
              : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 22,
    paddingBottom: 70,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: colors.background,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  errorTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },

  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  title: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 5,
  },

  copy: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 440,
  },

  zoom: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: 18,
    padding: 4,
    marginTop: 24,
    gap: 3,
  },

  zoomButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
  },

  zoomButtonActive: {
    backgroundColor: colors.surface,
  },

  zoomText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  zoomTextActive: {
    color: colors.text,
  },

  seasonalCard: {
    marginTop: 24,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 22,
  },

  sectionKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 3,
    marginBottom: 15,
  },

  seasonalYear: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },

  seasonalYearLabel: {
    width: 48,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },

  seasonalEvents: {
    flex: 1,
    gap: 6,
  },

  seasonalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  seasonalMark: {
    width: 14,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },

  seasonalText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },

  moreText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },

  emptyCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },

  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },

  yearGrid: {
    marginTop: 26,
    gap: 12,
  },

  yearCard: {
    padding: 21,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  yearNumber: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },

  yearMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },

  yearTime: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },

  yearPicker: {
    paddingVertical: 22,
    gap: 8,
  },

  yearPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },

  yearPillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },

  yearPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  yearPillTextActive: {
    color: colors.background,
  },

  month: {
    marginBottom: 30,
  },

  monthHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },

  monthName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: -0.5,
  },

  dayName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: -0.3,
  },

  monthMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  monthYear: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },

  timeline: {
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },

  event: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },

  eventRail: {
    width: 28,
    paddingTop: 2,
  },

  eventMark: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },

  eventBody: {
    flex: 1,
    minWidth: 0,
  },

  eventTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  eventKind: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  eventDate: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },

  eventTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    marginTop: 4,
  },

  eventSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  eventMeta: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
  },

  entryPreview: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
});
