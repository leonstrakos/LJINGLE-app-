import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import {
  reconstructPeriod,
  reconstructionDay,
  reconstructionMonth,
  reconstructionYear,
} from '../storage/reconstruction';
import { colors } from '../theme/colors';
import { semanticFeedback } from '../utils/semanticFeedback';
import type { Reconstruction } from '../types/reconstruction';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

// reconstructionScreenV1A
// paletteYearRouteV1
type ReconstructionScreenProps =
  NativeStackScreenProps<
    RootStackParamList,
    'Reconstruction'
  >;
function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (!hours) return `${minutes} min`;
  if (!rest) return `${hours} h`;

  return `${hours} h ${rest} min`;
}

function eventTimeLabel(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('hr-HR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventKindLabel(kind: string) {
  switch (kind) {
    case 'SESSION':
      return 'AKTIVNOST';
    case 'ENTRY':
      return 'ZAPIS';
    case 'BOOK_STARTED':
      return 'POČEO ČITATI';
    case 'BOOK_FINISHED':
      return 'ZAVRŠIO KNJIGU';
    case 'MEDIA_STARTED':
      return 'POČEO GLEDATI';
    case 'MEDIA_COMPLETED':
      return 'ZAVRŠIO GLEDATI';
    case 'GAME_STARTED':
      return 'POČEO IGRATI';
    case 'GAME_FINISHED':
      return 'ZAVRŠIO IGRU';
    default:
      return kind.replaceAll('_', ' ');
  }
}

function shiftMonth(
  year: number,
  month: number,
  delta: number,
) {
  const date = new Date(
    year,
    month - 1 + delta,
    1,
    12,
  );

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function ReconstructionScreen({
  route,
}: ReconstructionScreenProps) {
  const now = new Date();

  const requestedYear =
    route.params?.year;

  const [year, setYear] =
    useState(
      requestedYear ??
        now.getFullYear(),
    );

  const [yearMode, setYearMode] =
    useState(
      typeof requestedYear ===
        'number',
    );

  const [month, setMonth] =
    useState(now.getMonth() + 1);

  const [day, setDay] =
    useState<number | null>(null);

  const [data, setData] =
    useState<Reconstruction | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);

    const period =
      yearMode
        ? reconstructionYear(year)
        : day === null
          ? reconstructionMonth(
              year,
              month,
            )
          : reconstructionDay(
              year,
              month,
              day,
            );

    void reconstructPeriod(period)
      .then(setData)
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Rekonstrukcija nije dostupna.',
        );
      });
  }, [year, month, day, yearMode]);

  function moveMonth(delta: number) {
    setDay(null);

    if (yearMode) {
      void semanticFeedback.selection();
      setYear(
        (current) =>
          current + delta,
      );
      return;
    }
    const next = shiftMonth(
      year,
      month,
      delta,
    );

    void semanticFeedback.selection();

    setYear(next.year);
    setMonth(next.month);
  }

  function openDay(date: string) {
    setYearMode(false);

    const parts = date.split('-').map(Number);
    const nextYear = parts[0];
    const nextMonth = parts[1];
    const nextDay = parts[2];

    if (!nextYear || !nextMonth || !nextDay) {
      return;
    }

    void semanticFeedback.selection();

    setYear(nextYear);
    setMonth(nextMonth);
    setDay(nextDay);
  }

  function returnToMonth() {
    void semanticFeedback.selection();
    setDay(null);
  }

  if (!data && !error) {
    return (
      <SafeAreaView style={styles.safe}>
      <AeroAtmosphere variant="history" />
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>
            Rekonstruiram period…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe}>
      <AeroAtmosphere variant="history" />
        <View style={styles.center}>
          <Text style={styles.heading}>
            Rekonstrukcija nije dostupna
          </Text>

          <Text style={styles.muted}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AeroAtmosphere variant="history" />
      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text style={styles.kicker}>
          OSOBNI ARHIV
        </Text>

        <View style={styles.periodNav}>
          <Pressable
            accessibilityLabel="Prethodni mjesec"
            onPress={() => moveMonth(-1)}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.periodNavLabel}>
            {yearMode
            ? 'GODINA'
            : 'MJESEC'}
          </Text>

          <Pressable
            accessibilityLabel="Sljedeći mjesec"
            onPress={() => moveMonth(1)}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>
              ›
            </Text>
          </Pressable>
        </View>

        <Text style={styles.title}>
          {data.period.label}
        </Text>

        <Text style={styles.intro}>
          Kako je ovaj dio života izgledao prema
          onome što je stvarno zabilježeno.
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {data.eventCount}
            </Text>
            <Text style={styles.statLabel}>
              događaja
            </Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {durationLabel(data.trackedSeconds)}
            </Text>
            <Text style={styles.statLabel}>
              praćenog vremena
            </Text>
          </View>
        </View>

        {data.firstEvent ? (
          <View style={styles.card}>
            <Text style={styles.label}>
              PRVI DOGAAJ
            </Text>
            <Text style={styles.cardTitle}>
              {data.firstEvent.title}
            </Text>
          </View>
        ) : null}

        {data.lastEvent ? (
          <View style={styles.card}>
            <Text style={styles.label}>
              ZADNJI DOGAAJ
            </Text>
            <Text style={styles.cardTitle}>
              {data.lastEvent.title}
            </Text>
          </View>
        ) : null}

        {day !== null ? (
          <Pressable
            onPress={returnToMonth}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>
              ← cijeli mjesec
            </Text>
          </Pressable>
        ) : null}

        {data.busiestDay && day === null ? (
          <Pressable
            onPress={() =>
              openDay(data.busiestDay!.date)
            }
            style={styles.card}
          >
            <Text style={styles.label}>
              NAJAKTIVNIJI DAN · OTVORI
            </Text>

            <Text style={styles.cardTitle}>
              {data.busiestDay.date}
            </Text>

            <Text style={styles.muted}>
              {data.busiestDay.eventCount} događaja
              {' · '}
              {durationLabel(
                data.busiestDay.trackedSeconds,
              )}
            </Text>
          </Pressable>
        ) : null}




{/* reconstructionActiveItemsV1 */}
{day !== null && data.activeItems.length > 0 ? (
  <>
    <Text style={styles.sectionTitle}>
      U to vrijeme
    </Text>

    {(['BOOK', 'MEDIA', 'GAME'] as const).map(
      (entityType) => {
        const items = data.activeItems.filter(
          (item) =>
            item.entityType === entityType,
        );

        if (items.length === 0) {
          return null;
        }

        const label =
          entityType === 'BOOK'
            ? 'ČITAO'
            : entityType === 'MEDIA'
              ? 'GLEDAO'
              : 'IGRAO';

        return (
          <View
            key={entityType}
            style={styles.card}
          >
            <Text style={styles.label}>
              {label}
            </Text>

            {items.map((item) => (
              <View
                key={`${item.entityType}-${item.entityId}`}
                style={{ marginTop: 9 }}
              >
                <Text style={styles.cardTitle}>
                  {item.title}
                </Text>

                {item.subtitle ? (
                  <Text style={styles.muted}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        );
      },
    )}
  </>
) : null}
{/* reconstructionDayTimelineV1 */}
{day !== null ? (
  <>
    <Text style={styles.sectionTitle}>
      Događaji tog dana
    </Text>

    {data.events.map((event, index) => (
      <View
        key={`${event.kind}-${event.at}-${index}`}
        style={styles.card}
      >
        <Text style={styles.label}>
          {eventKindLabel(event.kind)}
        </Text>

        <Text style={styles.cardTitle}>
          {event.title}
        </Text>

        {event.subtitle ? (
          <Text style={styles.muted}>
            {event.subtitle}
          </Text>
        ) : null}

        {event.durationSeconds ? (
          <Text style={styles.muted}>
            {durationLabel(event.durationSeconds)}
          </Text>
        ) : null}
      </View>
    ))}
  </>
) : null}


        <Text style={styles.sectionTitle}>
          Što je bilo ovdje
        </Text>

        {data.categories.map((category) => (
          <View
            key={category.category}
            style={styles.category}
          >
            <View>
              <Text style={styles.categoryName}>
                {category.category}
              </Text>

              <Text style={styles.muted}>
                {category.eventCount} događaja
              </Text>
              {/* reconstructionMonthPersonalityV1 */}
                    {category.titles.length > 0 ? (
                      <Text
                        style={[
                          styles.muted,
                          {
                            marginTop: 7,
                            lineHeight: 18,
                          },
                        ]}
                      >
                        {category.titles
                          .slice(0, 5)
                          .join(' · ')}

                        {category.titles.length > 5
                          ? ` · +${category.titles.length - 5}`
                          : ''}
                      </Text>
                    ) : null}
            </View>

            {category.trackedSeconds ? (
              <Text style={styles.categoryTime}>
                {durationLabel(
                  category.trackedSeconds,
                )}
              </Text>
            ) : null}
          </View>
        ))}

{/* reconstructionPeriodRhythmV1 */}
{data.activities.length > 0 ? (
  <>
    <Text style={styles.sectionTitle}>
      Ritam perioda
    </Text>

    <View style={styles.card}>
      {data.activities
        .slice(0, 6)
        .map((activity, index) => (
          <View
            key={activity.label}
            style={{
              paddingTop: index === 0 ? 0 : 12,
              paddingBottom: 12,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.separator,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    flex: 1,
                    marginTop: 0,
                  },
                ]}
              >
                {activity.label}
              </Text>

              <Text style={styles.categoryTime}>
                {durationLabel(
                  activity.trackedSeconds,
                )}
              </Text>
            </View>

            <Text style={styles.muted}>
              {activity.sessionCount}{' '}
              {activity.sessionCount === 1
                ? 'sesija'
                : 'sesija'}
            </Text>
          </View>
        ))}
    </View>
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
    gap: 12,
    padding: 30,
  },

  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 8,
  },

  backButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  periodNavLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  navButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  navButtonText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },

  title: {
    marginTop: 5,
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
    textTransform: 'capitalize',
  },

  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },

  intro: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },

  stats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },

  stat: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },

  statLabel: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  card: {
    marginTop: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  label: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  cardTitle: {
    marginTop: 5,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },

  muted: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },

  sectionTitle: {
    marginTop: 30,
    marginBottom: 8,
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },

  category: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },

  categoryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },

  categoryTime: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
});







