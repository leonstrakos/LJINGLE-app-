import {
  useCallback,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { colors } from '../theme/colors';

import {
  loadAroundSameTime,
  type TemporalNeighbour,
  type TemporalNeighbourKind,
  type TemporalRelationEntityType,
} from '../storage/softTemporalRelations';

// aroundSameTimeV1

type Props = {
  entityType:
    TemporalRelationEntityType;

  entityId: string;
};

const kindLabels:
  Record<
    TemporalNeighbourKind,
    string
  > = {
    BOOK: 'KNJIGA',
    MOVIE: 'FILM',
    SERIES: 'SERIJA',
    GAME: 'IGRA',
  };

function distanceLabel(
  deltaDays: number,
) {
  if (
    Math.abs(deltaDays) <= 0
  ) {
    return 'isti dan';
  }

  const absolute =
    Math.abs(deltaDays);

  const direction =
    deltaDays < 0
      ? 'ranije'
      : 'kasnije';

  if (absolute === 1) {
    return (
      '1 dan ' +
      direction
    );
  }

  if (absolute < 7) {
    return (
      absolute +
      ' dana ' +
      direction
    );
  }

  if (absolute < 35) {
    const weeks =
      Math.max(
        1,
        Math.round(
          absolute / 7,
        ),
      );

    return (
      weeks +
      (weeks === 1
        ? ' tjedan '
        : ' tjedna ') +
      direction
    );
  }

  const months =
    Math.max(
      1,
      Math.round(
        absolute / 30.44,
      ),
    );

  return (
    months +
    (months === 1
      ? ' mj. '
      : ' mj. ') +
    direction
  );
}

export function AroundSameTimeSection({
  entityType,
  entityId,
}: Props) {
  const [
    items,
    setItems,
  ] = useState<
    TemporalNeighbour[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void loadAroundSameTime(
        entityType,
        entityId,
      )
        .then((result) => {
          if (active) {
            setItems(result);
          }
        })
        .catch(() => {
          if (active) {
            setItems([]);
          }
        });

      return () => {
        active = false;
      };
    }, [
      entityId,
      entityType,
    ]),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>
        AROUND THE SAME TIME
      </Text>

      <Text style={styles.copy}>
        Stvari koje se pojavljuju blizu
        istog vremena u tvojoj zabilježenoj
        kronologiji.
      </Text>

      <View style={styles.list}>
        {items.map(
          (item) => (
            <View
              key={
                item.entityType +
                ':' +
                item.entityId
              }
              style={styles.row}
            >
              <View
                style={styles.rowCopy}
              >
                <Text
                  style={styles.kind}
                >
                  {
                    kindLabels[
                      item.kind
                    ]
                  }
                </Text>

                <Text
                  numberOfLines={2}
                  style={styles.title}
                >
                  {item.title}
                </Text>
              </View>

              <Text
                style={styles.distance}
              >
                {distanceLabel(
                  item.deltaDays,
                )}
              </Text>
            </View>
          ),
        )}
      </View>

      <Text style={styles.footer}>
        Automatski uočeno iz stvarnih
        datuma i sesija · nije spremljena
        relacija.
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    card: {
      marginTop: 16,
      padding: 17,
      borderWidth: 1,
      borderColor:
        colors.separator,
      borderRadius: 18,
      backgroundColor:
        colors.surface,
    },

    eyebrow: {
      color:
        colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    copy: {
      marginTop: 6,
      color:
        colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },

    list: {
      marginTop: 12,
    },

    row: {
      minHeight: 55,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.separator,
    },

    rowCopy: {
      flex: 1,
      minWidth: 0,
    },

    kind: {
      color:
        colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.75,
    },

    title: {
      marginTop: 3,
      color:
        colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },

    distance: {
      flexShrink: 0,
      color:
        colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'right',
    },

    footer: {
      marginTop: 9,
      color:
        colors.textMuted,
      fontSize: 9,
      lineHeight: 14,
    },
  });
