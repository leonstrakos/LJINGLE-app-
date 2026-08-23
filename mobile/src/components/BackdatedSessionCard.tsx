import {
  useMemo,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../theme/colors';

import {
  createBackdatedSession,
  type BackdatedEntityType,
} from '../storage/backdatedSessions';

// backdatedSessionsV1

type Props = {
  entityType:
    BackdatedEntityType;

  entityId: string;
};

function pad(value: number) {
  return String(value)
    .padStart(2, '0');
}

function initialValues() {
  const date =
    new Date(
      Date.now() -
        30 * 60 * 1000,
    );

  return {
    date:
      date.getFullYear() +
      '-' +
      pad(
        date.getMonth() + 1,
      ) +
      '-' +
      pad(
        date.getDate(),
      ),

    time:
      pad(
        date.getHours(),
      ) +
      ':' +
      pad(
        date.getMinutes(),
      ),
  };
}

function formatSavedDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'hr-HR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

export function BackdatedSessionCard({
  entityType,
  entityId,
}: Props) {
  const defaults =
    useMemo(
      () => initialValues(),
      [],
    );

  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const [
    date,
    setDate,
  ] = useState(
    defaults.date,
  );

  const [
    time,
    setTime,
  ] = useState(
    defaults.time,
  );

  const [
    duration,
    setDuration,
  ] = useState('30');

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

  const [
    saved,
    setSaved,
  ] = useState<
    string | null
  >(null);

  const save = async () => {
    if (saving) {
      return;
    }

    setError(null);
    setSaved(null);

    const local =
      new Date(
        date +
          'T' +
          time +
          ':00',
      );

    if (
      Number.isNaN(
        local.getTime(),
      )
    ) {
      setError(
        'Provjeri datum i vrijeme.'
      );
      return;
    }

    const minutes =
      Number(duration);

    setSaving(true);

    try {
      const result =
        await createBackdatedSession({
          entityType,
          entityId,
          startedAt:
            local.toISOString(),
          durationMinutes:
            minutes,
        });

      setSaved(
        formatSavedDate(
          result.startedAt,
        ) +
          ' · ' +
          result.durationMinutes +
          ' min',
      );

      setExpanded(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Sesija nije spremljena.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>
            BACKDATE
          </Text>

          <Text style={styles.title}>
            Zaboravio si timer?
          </Text>

          <Text style={styles.copy}>
            Dodaj stvarnu sesiju
            naknadno u svoju
            kronologiju.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setError(null);
            setExpanded(
              (current) =>
                !current,
            );
          }}
          style={({ pressed }) => [
            styles.toggle,
            pressed &&
              styles.pressed,
          ]}
        >
          <Text style={styles.toggleText}>
            {expanded
              ? 'ZATVORI'
              : '+ SESIJA'}
          </Text>
        </Pressable>
      </View>

      {saved ? (
        <Text style={styles.saved}>
          ✓ Spremljeno · {saved}
        </Text>
      ) : null}

      {expanded ? (
        <View style={styles.editor}>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>
                DATUM
              </Text>

              <TextInput
                value={date}
                onChangeText={setDate}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
              />
            </View>

            <View style={styles.fieldSmall}>
              <Text style={styles.label}>
                POČETAK
              </Text>

              <TextInput
                value={time}
                onChangeText={setTime}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="HH:MM"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <Text style={styles.label}>
                TRAJANJE
              </Text>

              <TextInput
                value={duration}
                onChangeText={
                  setDuration
                }
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>
              minuta
            </Text>
          </View>

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
              style={({ pressed }) => [
                styles.save,
                pressed &&
                  styles.pressed,
                saving &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.saveText}>
                {saving
                  ? 'SPREMAM…'
                  : 'SPREMI SESIJU'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                setExpanded(false);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.cancel,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>
                ODUSTANI
              </Text>
            </Pressable>
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

    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },

    headingCopy: {
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
      maxWidth: 370,
      color:
        colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },

    toggle: {
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor:
        colors.fill,
    },

    toggleText: {
      color:
        colors.text,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.45,
    },

    saved: {
      marginTop: 12,
      color:
        colors.text,
      fontSize: 11,
      fontWeight: '700',
    },

    editor: {
      marginTop: 16,
      paddingTop: 15,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.separator,
    },

    fieldRow: {
      flexDirection: 'row',
      gap: 9,
    },

    field: {
      flex: 1.35,
    },

    fieldSmall: {
      flex: 0.8,
    },

    label: {
      marginBottom: 6,
      color:
        colors.textMuted,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
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

    durationRow: {
      marginTop: 11,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 9,
    },

    durationField: {
      width: 110,
    },

    minutes: {
      paddingBottom: 12,
      color:
        colors.textMuted,
      fontSize: 11,
    },

    error: {
      marginTop: 10,
      color:
        colors.danger,
      fontSize: 11,
      lineHeight: 16,
    },

    actions: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    save: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor:
        colors.navy,
    },

    saveText: {
      color:
        colors.white,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.45,
    },

    cancel: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor:
        colors.fill,
    },

    cancelText: {
      color:
        colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
    },

    pressed: {
      opacity: 0.72,
    },

    disabled: {
      opacity: 0.5,
    },
  });
