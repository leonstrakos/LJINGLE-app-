// ljinglePortalAvatarMobileR1
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  pickProfileAvatar,
  removeProfileAvatar,
  resolveProfileAvatarUri,
  saveProfileAvatar,
  type PendingProfileAvatar,
} from '../services/profileAvatar';
import { colors } from '../theme/colors';
import type { SocialProfile } from '../types/social';
import { semanticFeedback } from '../utils/semanticFeedback';

// ljinglePortalAvatarDisplayR2
// ljinglePortalAvatarEndToEndR3
export function SocialProfileAvatar({
  profile,
  style,
  textStyle,
}: {
  profile: Pick<SocialProfile, 'displayName' | 'username' | 'avatarUrl'>;
  style?: any;
  textStyle?: any;
}) {
  const avatarUrl = profile.avatarUrl?.trim() || null;
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    setFailed(false);

    if (!avatarUrl) {
      return () => { cancelled = true; };
    }

    void resolveProfileAvatarUri(avatarUrl)
      .then((uri) => {
        if (cancelled) return;
        if (uri) setLocalUri(uri);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [avatarUrl]);

  const initial = (profile.displayName || profile.username || '?').slice(0, 1).toUpperCase();

  if (avatarUrl && localUri && !failed) {
    return (
      <Image
        key={avatarUrl}
        onError={() => setFailed(true)}
        resizeMode="cover"
        source={{ uri: localUri }}
        style={style}
      />
    );
  }

  // Never leave an empty dark circle: while loading or after any image failure,
  // keep the same initial fallback the Portal had before custom avatars.
  return <View style={style}><Text style={textStyle}>{initial}</Text></View>;
}

export function PortalAvatarControls({
  profile,
  disabled = false,
  onProfileChange,
}: {
  profile: SocialProfile | null;
  disabled?: boolean;
  onProfileChange: (profile: SocialProfile) => void;
}) {
  const [pending, setPending] = useState<PendingProfileAvatar | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    if (disabled || picking || saving || removing) return;
    setPicking(true);
    setError(null);
    try {
      const selected = await pickProfileAvatar();
      if (selected) setPending(selected);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Odabir avatara nije uspio.');
    } finally {
      setPicking(false);
    }
  };

  const save = async () => {
    if (!pending || disabled || saving) return;
    setSaving(true);
    setError(null);
    try {
      onProfileChange(await saveProfileAvatar(pending));
      setPending(null);
      void semanticFeedback.complete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Avatar se nije mogao spremiti.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!profile?.avatarUrl || disabled || removing) return;
    setRemoving(true);
    setError(null);
    try {
      onProfileChange(await removeProfileAvatar());
      setPending(null);
      void semanticFeedback.complete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Avatar se nije mogao ukloniti.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.currentAvatarWrap}>
          {profile ? (
            <SocialProfileAvatar profile={profile} style={styles.currentAvatar} textStyle={styles.currentInitial} />
          ) : (
            <View style={styles.currentAvatar}><Text style={styles.currentInitial}>?</Text></View>
          )}
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>AVATAR</Text>
          <Text style={styles.heading}>{profile?.avatarUrl ? 'Koristiš svoj avatar' : 'Inicijal kao avatar'}</Text>
          <Text style={styles.copy}>Slika se sprema uz tvoj Portal profil i prikazuje drugima umjesto inicijala.</Text>
        </View>
        {profile?.avatarUrl ? <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>CUSTOM</Text></View> : null}
      </View>

      {pending ? (
        <View style={styles.previewArea}>
          <Image resizeMode="cover" source={{ uri: pending.sourceUri }} style={styles.preview} />
          <View style={styles.previewCopy}>
            <Text numberOfLines={2} style={styles.previewName}>{pending.fileName ?? 'Novi avatar'}</Text>
            <Text style={styles.previewHint}>Pregled prije spremanja</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pending ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || saving}
            onPress={() => setPending(null)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Odustani</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || saving}
            onPress={() => void save()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryText}>Spremi</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || picking || removing}
            onPress={() => void pick()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            {picking ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.primaryText}>{profile?.avatarUrl ? 'Promijeni' : 'Promijeni avatar'}</Text>
            )}
          </Pressable>
          {profile?.avatarUrl ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled || removing}
              onPress={() => void remove()}
              style={({ pressed }) => [styles.secondaryButton, styles.restoreButton, pressed && styles.pressed]}
            >
              {removing ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={styles.secondaryText}>Vrati inicijal</Text>}
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, paddingBottom: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center' },
  currentAvatarWrap: { marginRight: 12 },
  currentAvatar: { width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  currentInitial: { color: colors.text, fontSize: 24, fontWeight: '800' },
  headingCopy: { flex: 1, marginRight: 8 },
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  heading: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  copy: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  activeBadge: { borderRadius: 8, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 7, paddingVertical: 4 },
  activeBadgeText: { color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  previewArea: { flexDirection: 'row', alignItems: 'center', marginTop: 14, borderRadius: 14, backgroundColor: colors.fillStrong, padding: 10 },
  preview: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: colors.gold },
  previewCopy: { flex: 1, marginLeft: 12 },
  previewName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  previewHint: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 13 },
  primaryButton: { flex: 1, minHeight: 43, borderRadius: 13, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { color: colors.onAccent, fontSize: 11, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 43, borderRadius: 13, borderWidth: 1, borderColor: colors.separator, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  restoreButton: { flex: 0.9 },
  secondaryText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.62 },
});
