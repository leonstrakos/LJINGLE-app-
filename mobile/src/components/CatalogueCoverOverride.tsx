import type { ReactNode } from 'react';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  deleteCatalogueCoverOverride,
  getCatalogueCoverOverride,
  peekCatalogueCoverOverride,
  pickCatalogueCover,
  saveCatalogueCoverOverride,
  subscribeCatalogueCoverOverrides,
  type CatalogueCoverEntityType,
  type PendingCatalogueCover,
} from '../services/catalogueCoverOverrides';
import { colors } from '../theme/colors';

function useCatalogueCoverOverride(
  entityType: CatalogueCoverEntityType,
  entityId: string,
) {
  const cached =
    peekCatalogueCoverOverride(
      entityType,
      entityId,
    );

  const [uri, setUri] = useState<string | null>(
    cached === undefined ? null : cached,
  );

  useEffect(() => {
    let active = true;

    const unsubscribe =
      subscribeCatalogueCoverOverrides(
        (
          changedType,
          changedId,
          changedUri,
        ) => {
          if (
            changedType === entityType &&
            changedId === entityId
          ) {
            setUri(changedUri);
          }
        },
      );

    void getCatalogueCoverOverride(
      entityType,
      entityId,
    ).then((nextUri) => {
      if (active) {
        setUri(nextUri);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [entityType, entityId]);

  return uri;
}

export function CatalogueCoverDisplay({
  entityType,
  entityId,
  imageStyle,
  children,
}: {
  entityType: CatalogueCoverEntityType;
  entityId: string;
  imageStyle?: any;
  children: ReactNode;
}) {
  const customUri = useCatalogueCoverOverride(
    entityType,
    entityId,
  );

  if (customUri) {
    return (
      <Image
        resizeMode="cover"
        source={{ uri: customUri }}
        style={imageStyle}
      />
    );
  }

  return <>{children}</>;
}

export function CatalogueCoverOverrideControls({
  entityType,
  entityId,
}: {
  entityType: CatalogueCoverEntityType;
  entityId: string;
}) {
  const customUri = useCatalogueCoverOverride(
    entityType,
    entityId,
  );

  const [pending, setPending] =
    useState<PendingCatalogueCover | null>(
      null,
    );

  const [picking, setPicking] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [restoring, setRestoring] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const pick = async () => {
    if (picking || saving || restoring) return;

    setPicking(true);
    setError(null);

    try {
      const selected =
        await pickCatalogueCover();

      if (selected) {
        setPending(selected);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Odabir slike nije uspio.',
      );
    } finally {
      setPicking(false);
    }
  };

  const save = async () => {
    if (!pending || saving) return;

    setSaving(true);
    setError(null);

    try {
      await saveCatalogueCoverOverride(
        entityType,
        entityId,
        pending,
      );

      setPending(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Naslovnica se nije mogla spremiti.',
      );
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!customUri || restoring) return;

    setRestoring(true);
    setError(null);

    try {
      await deleteCatalogueCoverOverride(
        entityType,
        entityId,
      );

      setPending(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Originalna naslovnica nije se mogla vratiti.',
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>
            NASLOVNICA
          </Text>

          <Text style={styles.heading}>
            {customUri
              ? 'Koristiš svoju naslovnicu'
              : 'Originalna naslovnica'}
          </Text>

          <Text style={styles.copy}>
            Ručna slika ne mijenja originalne
            podatke iz online izvora.
          </Text>
        </View>

        {customUri ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>
              CUSTOM
            </Text>
          </View>
        ) : null}
      </View>

      {pending ? (
        <View style={styles.previewArea}>
          <Image
            resizeMode="cover"
            source={{ uri: pending.sourceUri }}
            style={styles.preview}
          />

          <View style={styles.previewCopy}>
            <Text
              numberOfLines={2}
              style={styles.previewName}
            >
              {pending.fileName ??
                'Nova naslovnica'}
            </Text>

            <Text style={styles.previewHint}>
              Pregled prije spremanja
            </Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}

      {pending ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => setPending(null)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>
              Odustani
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color={colors.white}
                size="small"
              />
            ) : (
              <Text style={styles.primaryText}>
                Spremi
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={picking || restoring}
            onPress={() => void pick()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            {picking ? (
              <ActivityIndicator
                color={colors.white}
                size="small"
              />
            ) : (
              <Text style={styles.primaryText}>
                {customUri
                  ? 'Promijeni'
                  : 'Promijeni naslovnicu'}
              </Text>
            )}
          </Pressable>

          {customUri ? (
            <Pressable
              accessibilityRole="button"
              disabled={restoring}
              onPress={() => void restore()}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.restoreButton,
                pressed && styles.pressed,
              ]}
            >
              {restoring ? (
                <ActivityIndicator
                  color={colors.text}
                  size="small"
                />
              ) : (
                <Text style={styles.secondaryText}>
                  Vrati original
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 16,
  },

  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  headingCopy: {
    flex: 1,
    marginRight: 12,
  },

  eyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  heading: {
    marginTop: 5,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },

  copy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },

  activeBadge: {
    borderRadius: 999,
    backgroundColor: colors.fillStrong,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  activeBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  previewArea: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.fill,
    padding: 10,
  },

  preview: {
    width: 72,
    height: 100,
    borderRadius: 11,
    backgroundColor: colors.fillStrong,
  },

  previewCopy: {
    flex: 1,
    marginLeft: 12,
  },

  previewName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },

  previewHint: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
  },

  error: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 11,
  },

  actions: {
    marginTop: 14,
    flexDirection: 'row',
  },

  primaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.black,
    paddingHorizontal: 15,
  },

  primaryText: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: '800',
  },

  secondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.fill,
    paddingHorizontal: 15,
  },

  restoreButton: {
    marginLeft: 8,
  },

  secondaryText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },

  pressed: {
    opacity: 0.68,
  },
});
