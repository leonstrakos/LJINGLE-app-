import {
  useCallback,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { colors } from '../theme/colors';

import {
  deleteApproximateDate,
  formatApproximateDate,
  getApproximateDate,
  setApproximateDate,
  type ApproximateDateEntityType,
  type ApproximateDatePrecision,
  type ApproximateDateRecord,
  type ApproximateSeason,
} from '../storage/approximateDates';

// uncertaintyDatesV1

type Props = {
  entityType:
    ApproximateDateEntityType;

  entityId: string;
};

const precisions: Array<{
  id: ApproximateDatePrecision;
  label: string;
}> = [
  {
    id: 'YEAR',
    label: 'GODINA',
  },
  {
    id: 'MONTH',
    label: 'MJESEC',
  },
  {
    id: 'SEASON',
    label: 'GOD. DOBA',
  },
];

const seasons: Array<{
  id: ApproximateSeason;
  label: string;
}> = [
  {
    id: 'SPRING',
    label: 'Proljeće',
  },
  {
    id: 'SUMMER',
    label: 'Ljeto',
  },
  {
    id: 'AUTUMN',
    label: 'Jesen',
  },
  {
    id: 'WINTER',
    label: 'Zima',
  },
];

const monthNames = [
  'Sij',
  'Velj',
  'Ožu',
  'Tra',
  'Svi',
  'Lip',
  'Srp',
  'Kol',
  'Ruj',
  'Lis',
  'Stu',
  'Pro',
];

export function ApproximateDateCard({
  entityType,
  entityId,
}: Props) {
  const [
    current,
    setCurrent,
  ] = useState<
    ApproximateDateRecord | null
  >(null);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    precision,
    setPrecision,
  ] = useState<
    ApproximateDatePrecision
  >('YEAR');

  const [
    year,
    setYear,
  ] = useState(
    String(
      new Date()
        .getFullYear(),
    ),
  );

  const [
    month,
    setMonth,
  ] = useState<
    number | null
  >(null);

  const [
    season,
    setSeason,
  ] = useState<
    ApproximateSeason | null
  >(null);

  const [
    note,
    setNote,
  ] = useState('');

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const load =
    useCallback(
      async () => {
        try {
          const value =
            await getApproximateDate(
              entityType,
              entityId,
            );

          setCurrent(value);
        } catch {
          setCurrent(null);
        }
      },
      [
        entityId,
        entityType,
      ],
    );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const beginEdit = () => {
    setError(null);

    if (current) {
      setPrecision(
        current.precision,
      );

      setYear(
        String(
          current.year,
        ),
      );

      setMonth(
        current.month,
      );

      setSeason(
        current.season,
      );

      setNote(
        current.note ?? '',
      );
    }

    setEditing(true);
  };

  const save = async () => {
    if (saving) {
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const saved =
        await setApproximateDate({
          entityType,
          entityId,

          precision,

          year:
            Number(year),

          month,

          season,

          note,
        });

      setCurrent(saved);
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Nije spremljeno.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteApproximateDate(
        entityType,
        entityId,
      );

      setCurrent(null);
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Datum nije uklonjen.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            APPROXIMATE DATE
          </Text>

          <Text style={styles.title}>
            Otprilike kada?
          </Text>

          <Text style={styles.copy}>
            Kad znaš period, ali ne
            želiš izmišljati točan datum.
          </Text>
        </View>

        {!editing ? (
          <Pressable
            accessibilityRole="button"
            onPress={beginEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text style={styles.editText}>
              {current
                ? 'UREDI'
                : '+ DODAJ'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {current &&
      !editing ? (
        <View style={styles.current}>
          <Text style={styles.period}>
            {formatApproximateDate(
              current,
            )}
          </Text>

          {current.note ? (
            <Text style={styles.note}>
              {current.note}
            </Text>
          ) : null}

          <Text style={styles.truth}>
            Spremljeno kao raspon,
            ne kao izmišljeni dan.
          </Text>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.label}>
            KOLIKO TOČNO ZNAŠ?
          </Text>

          <View style={styles.chips}>
            {precisions.map(
              (item) => {
                const active =
                  precision ===
                  item.id;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setPrecision(
                        item.id,
                      );

                      setError(null);
                    }}
                    style={[
                      styles.chip,
                      active &&
                        styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active &&
                          styles.chipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>

          <Text style={styles.label}>
            GODINA
          </Text>

          <TextInput
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            placeholder="2021"
            placeholderTextColor={
              colors.textMuted
            }
            style={styles.input}
          />

          {precision ===
          'MONTH' ? (
            <>
              <Text style={styles.label}>
                MJESEC
              </Text>

              <View
                style={styles.monthGrid}
              >
                {monthNames.map(
                  (
                    label,
                    index,
                  ) => {
                    const value =
                      index + 1;

                    const active =
                      month ===
                      value;

                    return (
                      <Pressable
                        key={label}
                        onPress={() =>
                          setMonth(
                            value,
                          )
                        }
                        style={[
                          styles.month,
                          active &&
                            styles.monthActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthText,
                            active &&
                              styles.monthTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </>
          ) : null}

          {precision ===
          'SEASON' ? (
            <>
              <Text style={styles.label}>
                GODIŠNJE DOBA
              </Text>

              <View style={styles.chips}>
                {seasons.map(
                  (item) => {
                    const active =
                      season ===
                      item.id;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() =>
                          setSeason(
                            item.id,
                          )
                        }
                        style={[
                          styles.chip,
                          active &&
                            styles.chipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active &&
                              styles.chipTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>
            NAPOMENA · OPCIONALNO
          </Text>

          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="npr. vjerojatno pred kraj ljeta"
            placeholderTextColor={
              colors.textMuted
            }
            style={[
              styles.input,
              styles.noteInput,
            ]}
          />

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() =>
                void save()
              }
              style={[
                styles.save,
                saving &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.saveText}>
                {saving
                  ? 'SPREMAM…'
                  : 'SPREMI'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                setEditing(false);
                setError(null);
              }}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>
                ODUSTANI
              </Text>
            </Pressable>

            {current ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() =>
                  void remove()
                }
                style={styles.remove}
              >
                <Text style={styles.removeText}>
                  UKLONI
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
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

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    eyebrow: {
      color:
        colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },

    title: {
      marginTop: 4,
      color:
        colors.text,
      fontSize: 17,
      fontWeight: '900',
    },

    copy: {
      marginTop: 4,
      maxWidth: 390,
      color:
        colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },

    editButton: {
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor:
        colors.fill,
    },

    editText: {
      color:
        colors.text,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.45,
    },

    current: {
      marginTop: 15,
      paddingTop: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.separator,
    },

    period: {
      color:
        colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
    },

    note: {
      marginTop: 5,
      color:
        colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },

    truth: {
      marginTop: 9,
      color:
        colors.textMuted,
      fontSize: 9,
      fontWeight: '700',
    },

    editor: {
      marginTop: 15,
      paddingTop: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.separator,
    },

    label: {
      marginTop: 13,
      marginBottom: 7,
      color:
        colors.textMuted,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.85,
    },

    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    chip: {
      minHeight: 35,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor:
        colors.separator,
      borderRadius: 999,
      backgroundColor:
        colors.background,
    },

    chipActive: {
      borderColor:
        colors.navy,
      backgroundColor:
        colors.navy,
    },

    chipText: {
      color:
        colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
    },

    chipTextActive: {
      color:
        colors.onAccent,
    },

    input: {
      minHeight: 42,
      borderWidth: 1,
      borderColor:
        colors.separator,
      borderRadius: 11,
      backgroundColor:
        colors.background,
      paddingHorizontal: 11,
      color:
        colors.text,
      fontSize: 13,
      fontWeight: '700',
    },

    noteInput: {
      minHeight: 70,
      paddingTop: 11,
      textAlignVertical: 'top',
    },

    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    month: {
      width: 48,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        colors.separator,
      borderRadius: 10,
      backgroundColor:
        colors.background,
    },

    monthActive: {
      borderColor:
        colors.navy,
      backgroundColor:
        colors.navy,
    },

    monthText: {
      color:
        colors.textMuted,
      fontSize: 9,
      fontWeight: '800',
    },

    monthTextActive: {
      color:
        colors.onAccent,
    },

    actions: {
      marginTop: 15,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    save: {
      minHeight: 39,
      justifyContent: 'center',
      paddingHorizontal: 15,
      borderRadius: 11,
      backgroundColor:
        colors.navy,
    },

    saveText: {
      color:
        colors.onAccent,
      fontSize: 10,
      fontWeight: '900',
    },

    cancel: {
      minHeight: 39,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 11,
      backgroundColor:
        colors.fill,
    },

    cancelText: {
      color:
        colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
    },

    remove: {
      minHeight: 39,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 11,
      backgroundColor:
        colors.dangerSoft,
    },

    removeText: {
      color:
        colors.danger,
      fontSize: 10,
      fontWeight: '900',
    },

    error: {
      marginTop: 10,
      color:
        colors.danger,
      fontSize: 11,
    },

    pressed: {
      opacity: 0.72,
    },

    disabled: {
      opacity: 0.5,
    },
  });
