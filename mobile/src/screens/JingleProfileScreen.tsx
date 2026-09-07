// jinglePortalThemeAndSendSpaceV1
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JingleBellIcon } from '../components/JingleBellIcon';
import { SocialProfileAvatar } from '../components/PortalAvatarControls';
import { LjingleStar } from '../components/LjingleStar';
// ljinglePortalAvatarMobileR1
import { socialApi } from '../services/socialApi';
import { importSocialCollection, importSocialEntity } from '../services/socialProjection';
import type { RootStackParamList } from '../types/navigation';
import type { SocialCatalogue, SocialCollectionSnapshot, SocialEntitySnapshot, SocialEntrySnapshot } from '../types/social';
import { entryTypeLabels } from '../types/entry';
// ljinglePortalCleanMineSharedEntriesR1
import { semanticFeedback } from '../utils/semanticFeedback';
import { colors } from '../theme/colors';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';

type Props = NativeStackScreenProps<RootStackParamList, 'JingleProfile'>;

const kindLabel = {
  BOOK: 'KNJIGA',
  MEDIA: 'FILM / SERIJA',
  GAME: 'IGRA',
} as const;

function EntityCover({ item, compact = false }: { item: SocialEntitySnapshot; compact?: boolean }) {
  if (item.coverUrl) {
    return <Image resizeMode="cover" source={{ uri: item.coverUrl }} style={[styles.cover, compact && styles.stripCover]} />;
  }
  return <View style={[styles.coverFallback, compact && styles.stripCover]}><Text numberOfLines={4} style={[styles.coverFallbackText, compact && styles.stripCoverText]}>{item.title}</Text></View>;
}

function RemoteEntryCard({ item }: { item: SocialEntrySnapshot }) {
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHead}>
        <Text style={styles.entryKind}>{entryTypeLabels[item.type]}</Text>
        <Text style={styles.entryDate}>{new Date(item.createdAt).toLocaleDateString('hr-HR')}</Text>
      </View>
      {item.title ? <Text style={styles.entryTitle}>{item.title}</Text> : null}
      <Text selectable style={styles.entryContent}>{item.content}</Text>
    </View>
  );
}

function RemoteEntityCard({
  item,
  onImport,
}: {
  item: SocialEntitySnapshot;
  onImport: (item: SocialEntitySnapshot) => void;
}) {
  return (
    <View style={styles.entityCard}>
      <EntityCover item={item} />
      <View style={styles.entityBody}>
        <Text style={styles.entityKind}>{kindLabel[item.kind]}</Text>
        <Text numberOfLines={3} style={styles.entityTitle}>{item.title}</Text>
        {item.subtitle ? <Text numberOfLines={2} style={styles.entityMeta}>{item.subtitle}{item.year ? ' · ' + item.year : ''}</Text> : null}
        <View style={styles.entityActions}>
          <Pressable onPress={() => onImport(item)} style={styles.addButton}><Text style={styles.addButtonText}>+ Dodaj u moje</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

// jinglePortalProfileDiamondCoverR2
type PortalCoverParticle = {
  left: string;
  top: string;
  size: number;
  opacity: number;
  variant: 'spark' | 'dot';
  bright: boolean;
};

function portalCoverNoise(
  index: number,
  salt: number,
) {
  const value =
    Math.sin(
      71.317 +
      index * 79.113 +
      salt * 43.771,
    ) * 43758.5453;

  return value - Math.floor(value);
}

function portalCoverClamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

function buildPortalCoverParticles() {
  const particles:
    PortalCoverParticle[] = [];

  for (
    let index = 0;
    index < 118;
    index += 1
  ) {
    const rawX =
      portalCoverNoise(
        index,
        1,
      );

    const rawY =
      portalCoverNoise(
        index,
        2,
      );

    const shape =
      portalCoverNoise(
        index,
        3,
      );

    const strength =
      portalCoverNoise(
        index,
        4,
      );

    const scale =
      portalCoverNoise(
        index,
        5,
      );

    const drift =
      portalCoverNoise(
        index,
        6,
      ) - 0.5;

    const survival =
      portalCoverNoise(
        index,
        7,
      );

    /*
     * Strong concentration at the upper cover.
     * Slowly opens and dissolves toward the bottom.
     */
    const depth =
      Math.pow(
        rawY,
        1.62,
      );

    const keepChance =
      0.995 -
      depth * 0.48;

    if (
      survival >
      keepChance
    ) {
      continue;
    }

    /*
     * Only diamond sparks and tiny silver dust.
     * No pluses / worms / signal shapes.
     */
    const variant:
      'spark' | 'dot' =
      shape > 0.66
        ? 'spark'
        : 'dot';

    const bright =
      variant === 'spark' &&
      strength > 0.31;

    /*
     * More extravagant than Home.
     */
    const baseSize =
      variant === 'spark'
        ? 8 +
          scale * 15
        : 1 +
          scale * 2;

    /*
     * Very gentle size recession downward.
     */
    const size =
      baseSize *
      (
        1 -
        depth * 0.16
      );

    const baseOpacity =
      variant === 'spark'
        ? 0.62 +
          strength * 0.35
        : 0.12 +
          strength * 0.22;

    /*
     * Fade toward lower edge.
     */
    const fade =
      Math.pow(
        1 - depth,
        1.08,
      );

    const opacity =
      Math.max(
        variant === 'spark'
          ? 0.075
          : 0.018,
        baseOpacity * fade,
      );

    /*
     * Upper region = tighter center constellation.
     * Lower region = much broader reflective spread.
     */
    const widthFactor =
      0.46 +
      depth * 0.54;

    const centerSpread =
      (
        rawX - 0.5
      ) *
      100 *
      widthFactor;

    const extraDrift =
      drift *
      (
        4 +
        depth * 30
      );

    const left =
      portalCoverClamp(
        50 +
        centerSpread +
        extraDrift,
        1,
        99,
      );

    const top =
      1 +
      depth * 98;

    particles.push({
      left:
        left.toFixed(2) +
        '%',

      top:
        top.toFixed(2) +
        '%',

      size:
        Math.max(
          1,
          size,
        ),

      opacity,

      variant,

      bright,
    });
  }

  return particles;
}

const PORTAL_COVER_PARTICLES =
  buildPortalCoverParticles();

function PortalProfileSparkleCover() {
  return (
    <View
      pointerEvents="none"
      style={
        styles.profileSparkleLayer
      }
    >
      {PORTAL_COVER_PARTICLES.map(
        (
          particle,
          index,
        ) => (
          <LjingleStar
            key={
              'portal-cover-' +
              index
            }
            variant={
              particle.variant
            }
            size={
              particle.size
            }
            color={
              particle.bright
                ? colors.text
                : colors.textMuted
            }
            opacity={
              particle.opacity
            }
            style={{
              position:
                'absolute',

              left:
                particle.left,

              top:
                particle.top,
            }}
          />
        ),
      )}
    </View>
  );
}

export function JingleProfileScreen({ route }: Props) {
  const { username } = route.params;
  const [catalogue, setCatalogue] = useState<SocialCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setCatalogue(await socialApi.catalogue(username));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Portal nije dostupan.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const addEntity = async (item: SocialEntitySnapshot) => {
    if (busyKey) return;
    setBusyKey(item.kind + ':' + item.entityId);
    setMessage(null);
    try {
      const result = await importSocialEntity(item);
      setMessage(result.created ? item.title + ' je dodano u tvoj katalog.' : item.title + ' je već u tvom katalogu.');
      void semanticFeedback.complete();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Nije moguće dodati u katalog.');
    } finally {
      setBusyKey(null);
    }
  };

  const addCollection = async (item: SocialCollectionSnapshot) => {
    if (busyKey) return;
    setBusyKey('COLLECTION:' + item.collectionId);
    setMessage(null);
    try {
      const result = await importSocialCollection(item);
      setMessage(item.name + ' je spremljen · ' + result.imported + ' stvari obrađeno.');
      void semanticFeedback.complete();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Kolekcija nije spremljena.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Ulazim u @{username} Portal…</Text></View></SafeAreaView>;
  }

  if (!catalogue) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.errorText}>{message || 'Portal nije pronađen.'}</Text></View></SafeAreaView>;
  }

  const current = catalogue.entities.filter((item) =>
    item.state === 'IN_PROGRESS' || item.state === 'WATCHING' || item.state === 'PLAYING',
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHero}>
          {/* ljingleCelestialMotionLanguageR1:profile */}
          <CelestialMotionLayer preset="profile" />
          <PortalProfileSparkleCover />
          <SocialProfileAvatar profile={catalogue.profile} style={styles.avatar} textStyle={styles.avatarText} />
          <Text style={styles.name}>{catalogue.profile.displayName}</Text>
          <Text style={styles.username}>@{catalogue.profile.username}</Text>
          {catalogue.profile.bio ? <Text style={styles.bio}>{catalogue.profile.bio}</Text> : null}
          <View style={styles.counts}>
            <Text style={styles.count}>{catalogue.profile.counts.books} knjiga</Text>
            <Text style={styles.dot}>✦</Text>
            <Text style={styles.count}>{catalogue.profile.counts.media} filmova / serija</Text>
            <Text style={styles.dot}>✦</Text>
            <Text style={styles.count}>{catalogue.profile.counts.games} igara</Text>
            <Text style={styles.dot}>✦</Text>
            <Text style={styles.count}>{catalogue.profile.counts.entries ?? 0} zapisa</Text>
          </View>
        </View>

        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
        {busyKey ? <ActivityIndicator color={colors.gold} style={styles.busy} /> : null}

        {current.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CURRENTLY WITH</Text>
            {current.map((item) => <RemoteEntityCard key={item.kind + ':' + item.entityId} item={item} onImport={(value) => void addEntity(value)} />)}
          </View>
        ) : null}

        {catalogue.collections.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COLLECTIONS</Text>
            {catalogue.collections.map((collection) => (
              <View key={collection.collectionId} style={styles.collectionCard}>
                <View style={styles.collectionHeader}>
                  <View style={styles.collectionSymbol}><Text style={styles.collectionSymbolText}>{collection.symbol || '✧'}</Text></View>
                  <View style={styles.collectionCopy}>
                    <Text style={styles.collectionTitle}>{collection.name}</Text>
                    <Text style={styles.collectionMeta}>{collection.items.length} stvari</Text>
                  </View>
                </View>
                {collection.description ? <Text style={styles.collectionDescription}>{collection.description}</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collectionStrip}>
                  {collection.items.map((item) => (
                    <View key={item.kind + ':' + item.entityId} style={styles.stripItem}>
                      <EntityCover compact item={item} />
                      <Text numberOfLines={2} style={styles.stripTitle}>{item.title}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.collectionActions}>
                  <Pressable onPress={() => void addCollection(collection)} style={styles.collectionAdd}><Text style={styles.collectionAddText}>+ Spremi kolekciju</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {(catalogue.entries ?? []).length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SHARED ENTRIES</Text>
            {(catalogue.entries ?? []).map((entry) => (
              <RemoteEntryCard key={entry.entryId} item={entry} />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SHARED THINGS</Text>
          {catalogue.entities.length === 0 ? <Text style={styles.empty}>Ovaj Portal zasad nema javnih stvari.</Text> : null}
          {catalogue.entities.filter((item) => !current.includes(item)).map((item) => (
            <RemoteEntityCard key={item.kind + ':' + item.entityId} item={item} onImport={(value) => void addEntity(value)} />
          ))}
        </View>

        <View style={styles.footer}><JingleBellIcon active style={styles.footerBell} /><Text style={styles.footerText}>Ovo je prozor u tuđi katalog, ne kopija njihovog privatnog arhiva.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { marginTop: 12, color: colors.textMuted },
  errorText: { color: colors.danger, textAlign: 'center' },
  profileHero: {
    position: 'relative',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 30,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  profileSparkleLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontSize: 28, fontWeight: '800' },
  name: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 12 },
  username: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 3 },
  bio: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 11, maxWidth: 420 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  count: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  dot: { color: colors.gold, fontSize: 8 },
  message: { marginHorizontal: 18, marginTop: 14, borderRadius: 13, padding: 12, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.separator },
  messageText: { color: colors.text, fontSize: 12, textAlign: 'center' },
  busy: { marginTop: 12 },
  section: { paddingHorizontal: 18, paddingTop: 24 },
  sectionLabel: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.1, marginBottom: 10 },
  entryCard: { marginBottom: 13, borderRadius: 20, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, padding: 15 },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  entryKind: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  entryDate: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  entryTitle: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '800', marginTop: 8 },
  entryContent: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 8 },
  entityCard: { flexDirection: 'row', minHeight: 172, marginBottom: 13, borderRadius: 20, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, overflow: 'hidden' },
  cover: { width: 112, minHeight: 172, backgroundColor: colors.fill },
  coverFallback: { width: 112, minHeight: 172, backgroundColor: colors.fillStrong, alignItems: 'center', justifyContent: 'center', padding: 10 },
  coverFallbackText: { color: colors.white, fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  entityBody: { flex: 1, padding: 14 },
  entityKind: { color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  entityTitle: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '800', marginTop: 5 },
  entityMeta: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  entityActions: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  collectionCard: { marginBottom: 15, borderRadius: 21, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, padding: 15 },
  collectionHeader: { flexDirection: 'row', alignItems: 'center' },
  collectionSymbol: { width: 43, height: 43, borderRadius: 14, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  collectionSymbolText: { color: colors.goldSoft, fontSize: 18 },
  collectionCopy: { flex: 1, marginLeft: 12 },
  collectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  collectionMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  collectionDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  collectionStrip: { marginTop: 13 },
  stripItem: { width: 86, marginRight: 9 },
  stripCover: { width: 86, height: 120, minHeight: 120 },
  stripCoverText: { fontSize: 10, lineHeight: 13 },
  stripTitle: { color: colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: '700', marginTop: 5 },
  collectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  collectionAdd: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  collectionAddText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 25 },
  footer: { alignItems: 'center', paddingHorizontal: 34, paddingTop: 32 },
  footerBell: { width: 28, height: 28 },
  footerText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 },
});
