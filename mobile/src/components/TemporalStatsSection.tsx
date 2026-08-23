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
import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  loadTemporalStats,
  type TemporalPeriod,
  type TemporalStatsComparison,
} from '../storage/temporalStats';
import { colors } from '../theme/colors';
import {
  activeVisualSkinId,
} from '../theme/visualSkins';

const pixelMode =
  activeVisualSkinId === 'pixel';

const aeroMode =
  activeVisualSkinId === 'aero';

function formatTime(
  seconds: number
) {
  const value =
    Math.max(
      0,
      Math.floor(seconds)
    );

  const hours =
    Math.floor(
      value / 3600
    );

  const minutes =
    Math.floor(
      (value % 3600) / 60
    );

  if (hours >= 10) {
    return `${hours} h`;
  }

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
}

function Period({
  title,
  period,
}: {
  title: string;
  period: TemporalPeriod;
}) {
  const visible =
    period.categories.slice(0, 4);

  return (
    <View style={styles.period}>
      <Text style={styles.periodTitle}>
        {title}
      </Text>

      <Text style={styles.periodTotal}>
        {formatTime(
          period.totalSeconds
        )}
      </Text>

      {visible.length === 0 ? (
        <Text style={styles.empty}>
          Nema mjerenog vremena.
        </Text>
      ) : (
        visible.map((item) => (
          <View
            key={item.key}
            style={styles.category}
          >
            <View style={styles.categoryHeader}>
              <Text
                style={styles.categoryLabel}
                numberOfLines={1}
              >
                {item.label}
              </Text>

              <Text style={styles.categoryShare}>
                {item.share}%
              </Text>
            </View>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    flex:
                      Math.max(
                        1,
                        item.share
                      ),
                  },
                ]}
              />

              <View
                style={{
                  flex:
                    Math.max(
                      0,
                      100 -
                        item.share
                    ),
                }}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function DefiningItems({
  title,
  period,
}: {
  title: string;
  period: TemporalPeriod;
}) {
  if (
    period.definingItems.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.definingColumn}>
      <Text style={styles.definingTitle}>
        {title}
      </Text>

      {period.definingItems
        .slice(0, 3)
        .map(
          (item, index) => (
            <View
              key={
                item.title +
                String(index)
              }
              style={styles.itemRow}
            >
              <Text style={styles.itemNumber}>
                {String(
                  index + 1
                ).padStart(2, '0')}
              </Text>

              <View style={styles.itemCopy}>
                <Text
                  style={styles.itemTitle}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>

                <Text style={styles.itemTime}>
                  {formatTime(
                    item.seconds
                  )}
                </Text>
              </View>
            </View>
          )
        )}
    </View>
  );
}

export function TemporalStatsSection() {
  const [data, setData] =
    useState<TemporalStatsComparison | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const load =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        setData(
          await loadTemporalStats(30)
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Promjena kroz vrijeme nije dostupna.'
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (
    loading &&
    !data
  ) {
    return (
      <View
        style={[
          styles.card,
          aeroMode &&
            styles.aeroGlass,
        ]}
      >
        <ActivityIndicator
          color={colors.text}
        />

        <Text style={styles.loadingText}>
          Uspoređujem periode…
        </Text>
      </View>
    );
  }

  if (
    !data ||
    error
  ) {
    return (
      <View
        style={[
          styles.card,
          aeroMode &&
            styles.aeroGlass,
        ]}
      >
        <Text style={styles.eyebrow}>
          PROMJENA KROZ VRIJEME
        </Text>

        <Text style={styles.title}>
          Prije → sada
        </Text>

        <Text style={styles.copy}>
          {error ??
            'Još nema dovoljno podataka za usporedbu.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void load()
          }
          style={styles.retry}
        >
          <Text style={styles.retryText}>
            Pokušaj ponovno
          </Text>
        </Pressable>
      </View>
    );
  }

  const hasPrevious =
    data.previous.totalSeconds > 0;

  const hasCurrent =
    data.current.totalSeconds > 0;

  return (
    <View
      style={[
        styles.card,
        aeroMode &&
          styles.aeroGlass,
      ]}
    >
      <Text style={styles.eyebrow}>
        PROMJENA KROZ VRIJEME
      </Text>

      <Text style={styles.title}>
        30 dana prije → sada
      </Text>

      <Text style={styles.copy}>
        Usporedba prethodnih 30 dana sa zadnjih 30 dana mjerenog života.
      </Text>

      <View style={styles.periods}>
        <Period
          title="PRETHODNIH 30"
          period={data.previous}
        />

        <View style={styles.arrowColumn}>
          <Text style={styles.arrow}>
            →
          </Text>
        </View>

        <Period
          title="ZADNJIH 30"
          period={data.current}
        />
      </View>

      {data.mover ? (
        <View style={styles.mover}>
          <Text style={styles.moverLabel}>
            NAJVEĆA PROMJENA
          </Text>

          <Text style={styles.moverValue}>
            {data.mover.deltaPoints > 0
              ? '↑'
              : data.mover.deltaPoints < 0
                ? '↓'
                : '→'}{' '}
            {data.mover.label}{' '}
            {data.mover.deltaPoints > 0
              ? '+'
              : ''}
            {data.mover.deltaPoints} pp
          </Text>

          <Text style={styles.moverMeta}>
            {data.mover.previousShare}% →{' '}
            {data.mover.currentShare}%
          </Text>
        </View>
      ) : !hasPrevious &&
        hasCurrent ? (
        <View style={styles.baseline}>
          <Text style={styles.baselineText}>
            Ovo je još prvi puni period. App gradi baseline za sljedeću usporedbu.
          </Text>
        </View>
      ) : null}

      {(data.previous.definingItems.length >
        0 ||
        data.current.definingItems.length >
          0) ? (
        <>
          <View style={styles.divider} />

          <Text style={styles.itemsEyebrow}>
            ŠTO JE DEFINIRALO PERIODE
          </Text>

          <View style={styles.itemsGrid}>
            <DefiningItems
              title="Tada"
              period={data.previous}
            />

            <DefiningItems
              title="Sada"
              period={data.current}
            />
          </View>
        </>
      ) : null}

      {!hasPrevious &&
      !hasCurrent ? (
        <Text style={styles.emptyAll}>
          Temporalna statistika pojavit će se čim postoje spremljene vremenske sesije.
        </Text>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    card: {
      marginTop: 18,
      padding: 18,
      borderRadius:
        pixelMode
          ? 0
          : 22,
      borderWidth:
        pixelMode
          ? 2
          : 1,
      borderColor:
        colors.separator,
      backgroundColor:
        colors.surface,
    },

    aeroGlass: {
      backgroundColor:
        'rgba(255,255,255,0.72)',
      borderColor:
        'rgba(255,255,255,0.96)',
      shadowColor:
        '#087D99',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 3,
    },

    eyebrow: {
      color:
        aeroMode
          ? '#087D99'
          : colors.textMuted,
      fontSize: 10,
      fontFamily:
        pixelMode
          ? 'monospace'
          : undefined,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    title: {
      marginTop: 5,
      color:
        aeroMode
          ? '#06366C'
          : colors.text,
      fontSize: 23,
      lineHeight: 28,
      fontFamily:
        pixelMode
          ? 'monospace'
          : undefined,
      fontWeight: '900',
      letterSpacing: -0.4,
    },

    copy: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },

    periods: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'stretch',
    },

    period: {
      flex: 1,
      minWidth: 0,
      padding: 13,
      borderRadius:
        pixelMode
          ? 0
          : 16,
      backgroundColor:
        colors.fillStrong,
    },

    arrowColumn: {
      width: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },

    arrow: {
      color: colors.textMuted,
      fontSize: 22,
      fontWeight: '700',
    },

    periodTitle: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    periodTotal: {
      marginTop: 4,
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },

    empty: {
      marginTop: 12,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },

    category: {
      marginTop: 11,
    },

    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 6,
    },

    categoryLabel: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },

    categoryShare: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
    },

    track: {
      flexDirection: 'row',
      height: 5,
      marginTop: 5,
      overflow: 'hidden',
      borderRadius: 999,
      backgroundColor:
        colors.surface,
    },

    fill: {
      backgroundColor:
        colors.black,
    },

    mover: {
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius:
        pixelMode
          ? 0
          : 14,
      borderWidth: 1,
      borderColor:
        colors.separator,
    },

    moverLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    moverValue: {
      marginTop: 4,
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },

    moverMeta: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 11,
    },

    baseline: {
      marginTop: 14,
      padding: 12,
      borderRadius:
        pixelMode
          ? 0
          : 14,
      backgroundColor:
        colors.fillStrong,
    },

    baselineText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 17,
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,
      marginTop: 18,
      backgroundColor:
        colors.separator,
    },

    itemsEyebrow: {
      marginTop: 15,
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    itemsGrid: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 14,
    },

    definingColumn: {
      flex: 1,
      minWidth: 0,
    },

    definingTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
    },

    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 9,
    },

    itemNumber: {
      width: 23,
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
    },

    itemCopy: {
      flex: 1,
      minWidth: 0,
    },

    itemTitle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },

    itemTime: {
      marginTop: 1,
      color: colors.textMuted,
      fontSize: 9,
    },

    emptyAll: {
      marginTop: 16,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 17,
    },

    loadingText: {
      marginTop: 8,
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
    },

    retry: {
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius:
        pixelMode
          ? 0
          : 12,
      backgroundColor:
        colors.fillStrong,
    },

    retryText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
  });
