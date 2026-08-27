import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  entityLinksApi,
} from '../services/entityLinksApi';
import {
  memoryRadioApi,
  pickLocalAudio,
} from '../services/memoryRadioApi';
import { colors } from '../theme/colors';
import {
  entityTypeLabels,
  type EntityReference,
} from '../types/collection';
import type {
  ImportedAudio,
} from '../types/memoryRadio';

type Props = {
  items: EntityReference[];
  onSaved: () => Promise<void> | void;
};

function directJingleTargets(
  items: EntityReference[],
) {
  return items.filter(
    (item) =>
      item.entityType === 'BOOK' ||
      item.entityType === 'MEDIA' ||
      item.entityType === 'GAME',
  );
}

// jingleRadioAttachPanelV1
export function JingleRadioAttachPanel({
  items,
  onSaved,
}: Props) {
  const targets =
    directJingleTargets(items);

  const [selected, setSelected] =
    React.useState<EntityReference | null>(
      targets[0] ?? null,
    );
  const [picked, setPicked] =
    React.useState<ImportedAudio | null>(null);
  const [title, setTitle] =
    React.useState('');
  const [artist, setArtist] =
    React.useState('');
  const [saving, setSaving] =
    React.useState(false);
  const [error, setError] =
    React.useState<string | null>(null);

  React.useEffect(() => {
    if (
      selected &&
      targets.some(
        (item) =>
          item.entityType ===
            selected.entityType &&
          item.entityId ===
            selected.entityId,
      )
    ) {
      return;
    }

    setSelected(
      targets[0] ?? null,
    );
  }, [items, selected]);

  const choose = async () => {
    setError(null);

    try {
      const next =
        await pickLocalAudio();

      if (!next) return;

      setPicked(next);
      setTitle(next.title);
      setArtist(next.artist);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Audio se nije mogao otvoriti.',
      );
    }
  };

  const save = async () => {
    if (
      !selected ||
      !picked ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    let trackId: string | null =
      null;

    try {
      trackId =
        await memoryRadioApi
          .createStandalone({
            ...picked,
            title:
              title.trim() ||
              picked.title,
            artist: artist.trim(),
          });

      await entityLinksApi.create({
        sourceType: 'FREQUENCY',
        sourceId: trackId,
        targetType:
          selected.entityType,
        targetId:
          selected.entityId,
        relationType:
          'REMEMBERED_WITH',
        note: null,
      });

      setPicked(null);
      setTitle('');
      setArtist('');

      await onSaved();
    } catch (caught) {
      if (trackId) {
        try {
          await memoryRadioApi
            .deleteTrack(trackId);
        } catch {
          // Best effort rollback only.
        }
      }

      setError(
        caught instanceof Error
          ? caught.message
          : 'Jingle zvuk nije spremljen.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>
            JINGLE SIGNAL
          </Text>
          <Text style={styles.title}>
            Odaberi Jingle stvar
          </Text>
        </View>

        <Text style={styles.count}>
          {targets.length}
        </Text>
      </View>

      {targets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            Još nema Jingle stvari
          </Text>
          <Text style={styles.emptyCopy}>
            Označi knjigu, film, seriju ili igru
            zvonom pa će se pojaviti ovdje.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.targets}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {targets.map((item) => {
            const active =
              selected?.entityType ===
                item.entityType &&
              selected?.entityId ===
                item.entityId;

            return (
              <Pressable
                key={
                  item.entityType +
                  ':' +
                  item.entityId
                }
                onPress={() =>
                  setSelected(item)
                }
                style={({ pressed }) => [
                  styles.target,
                  active &&
                    styles.targetActive,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.targetType,
                    active &&
                      styles.targetTypeActive,
                  ]}
                >
                  {
                    entityTypeLabels[
                      item.entityType
                    ]
                  }
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.targetTitle,
                    active &&
                      styles.targetTitleActive,
                  ]}
                >
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.targetMeta,
                      active &&
                        styles.targetMetaActive,
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selected ? (
        <>
          <Text style={styles.label}>
            ZVUK ZA
          </Text>

          <View style={styles.selected}>
            <View style={styles.selectedCopy}>
              <Text
                numberOfLines={1}
                style={styles.selectedTitle}
              >
                {selected.title}
              </Text>
              <Text style={styles.selectedMeta}>
                {
                  entityTypeLabels[
                    selected.entityType
                  ]
                }
              </Text>
            </View>

            <Text style={styles.bell}>
              ✦
            </Text>
          </View>

          <Pressable
            onPress={() => void choose()}
            style={({ pressed }) => [
              styles.fileButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.fileTitle}>
              {picked
                ? picked.originalName
                : 'Odaberi audio datoteku'}
            </Text>
            <Text style={styles.fileCopy}>
              {picked
                ? 'Spremno za Jingle frekvenciju.'
                : 'Lokalni MP3, M4A, WAV ili drugi podržani audio'}
            </Text>
          </Pressable>

          {picked ? (
            <>
              <Text style={styles.label}>
                NASLOV
              </Text>
              <TextInput
                onChangeText={setTitle}
                placeholder="Naslov"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
                value={title}
              />

              <Text style={styles.label}>
                IZVOĐAČ
              </Text>
              <TextInput
                onChangeText={setArtist}
                placeholder="Neobavezno"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
                value={artist}
              />

              <Text style={styles.fullTrackNote}>
                Jingle veza koristi cijelu audio
                datoteku. Rezanje ostaje dostupno
                za audio vezan uz Zapis.
              </Text>

              <Pressable
                disabled={saving}
                onPress={() => void save()}
                style={({ pressed }) => [
                  styles.save,
                  saving &&
                    styles.disabled,
                  pressed &&
                    styles.pressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color={colors.white}
                  />
                ) : (
                  <Text style={styles.saveText}>
                    POVEŽI ZVUK S JINGLEOM
                  </Text>
                )}
              </Pressable>
            </>
          ) : null}
        </>
      ) : null}

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const React = require('react') as typeof import('react');

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  count: {
    minWidth: 34,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  targets: {
    gap: 9,
    paddingTop: 16,
    paddingRight: 8,
    paddingBottom: 3,
  },
  target: {
    width: 158,
    minHeight: 92,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.background,
  },
  targetActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  targetType: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  targetTypeActive: {
    color: 'rgba(255,255,255,0.68)',
  },
  targetTitle: {
    marginTop: 6,
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  targetTitleActive: {
    color: colors.white,
  },
  targetMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 9,
  },
  targetMetaActive: {
    color: 'rgba(255,255,255,0.66)',
  },
  empty: {
    marginTop: 15,
    padding: 16,
    borderRadius: 17,
    backgroundColor: colors.fill,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCopy: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  selected: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.fill,
  },
  selectedCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  bell: {
    color: '#D69A20',
    fontSize: 19,
    fontWeight: '900',
  },
  fileButton: {
    marginTop: 16,
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.background,
  },
  fileTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  fileCopy: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
  },
  fullTrackNote: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  save: {
    minHeight: 49,
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.navy,
    paddingHorizontal: 15,
  },
  saveText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
