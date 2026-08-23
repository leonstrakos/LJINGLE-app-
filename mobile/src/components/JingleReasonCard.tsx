import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useEffect,
  useState,
} from 'react';

import {
  getJingleReason,
  setJingleReason,
  type JingleReasonEntityType,
} from '../storage/jingleReasons';
import { colors } from '../theme/colors';

type Props = {
  entityType: JingleReasonEntityType;
  entityId: string;
};

export function JingleReasonCard({
  entityType,
  entityId,
}: Props) {
  const [reason, setReason] =
    useState('');

  const [draft, setDraft] =
    useState('');

  const [editing, setEditing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    void getJingleReason(
      entityType,
      entityId,
    )
      .then((result) => {
        if (cancelled) return;

        const next =
          result?.reason ?? '';

        setReason(next);
        setDraft(next);
      })
      .catch((caught) => {
        if (cancelled) return;

        setError(
          caught instanceof Error
            ? caught.message
            : 'Jingle bilješka nije učitana.',
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
  }, [
    entityId,
    entityType,
  ]);

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const saved =
        await setJingleReason(
          entityType,
          entityId,
          draft,
        );

      const next =
        saved?.reason ?? '';

      setReason(next);
      setDraft(next);
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Jingle bilješka nije spremljena.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!editing && !reason) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dodaj razlog za Jingle"
        onPress={() => {
          setDraft('');
          setEditing(true);
        }}
        style={({ pressed }) => [
          styles.emptyCard,
          pressed &&
            styles.pressed,
        ]}
      >
        <Image
          source={require('../assets/aero/fav.png')}
          resizeMode="contain"
          style={styles.bellSmall}
        />

        <View style={styles.emptyCopy}>
          <Text style={styles.eyebrow}>
            JINGLE
          </Text>

          <Text style={styles.emptyTitle}>
            Zašto mi ovo znači?
          </Text>

          <Text style={styles.emptyHint}>
            Dodaj kratku uspomenu ili razlog
          </Text>
        </View>

        <Text style={styles.arrow}>
          ›
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Image
            source={require('../assets/aero/fav.png')}
            resizeMode="contain"
            style={styles.bell}
          />

          <Text style={styles.eyebrow}>
            JINGLE · ZAŠTO MI OVO ZNAČI
          </Text>
        </View>

        {!editing ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraft(reason);
              setEditing(true);
            }}
            style={({ pressed }) => [
              styles.editButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text style={styles.editText}>
              Uredi
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <>
          <TextInput
            autoFocus
            multiline
            maxLength={500}
            placeholder="Mjesto, osoba, period, osjećaj, razlog..."
            placeholderTextColor={
              colors.textMuted
            }
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
          />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                setDraft(reason);
                setEditing(false);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>
                Odustani
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() =>
                void save()
              }
              style={({ pressed }) => [
                styles.saveButton,
                pressed &&
                  styles.pressed,
                saving &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.saveText}>
                {saving
                  ? 'Spremam...'
                  : 'Spremi'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.reason}>
          {reason}
        </Text>
      )}

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    marginTop: 14,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  bellSmall: {
    width: 32,
    height: 38,
    marginRight: 12,
    opacity: 0.8,
  },

  emptyCopy: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.75,
  },

  emptyTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },

  emptyHint: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },

  arrow: {
    marginLeft: 10,
    color: colors.textMuted,
    fontSize: 26,
    fontWeight: '300',
  },

  card: {
    marginTop: 14,
    padding: 16,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  heading: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bell: {
    width: 26,
    height: 31,
    marginRight: 8,
  },

  reason: {
    marginTop: 11,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },

  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  editText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  input: {
    minHeight: 100,
    marginTop: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },

  actions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },

  cancelButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  cancelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.black,
  },

  saveText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },

  error: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
  },

  pressed: {
    opacity: 0.65,
  },

  disabled: {
    opacity: 0.45,
  },
});
