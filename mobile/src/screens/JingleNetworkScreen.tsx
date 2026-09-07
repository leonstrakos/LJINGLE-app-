// jinglePortalThemeAndSendSpaceV1
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { JingleBellIcon } from '../components/JingleBellIcon';
import { CollectionMemoryBoxGlyph } from '../components/CollectionMemoryBoxGlyph';
import { LjingleBoxedReveal } from '../components/LjingleBoxedReveal';
import { PortalAvatarControls } from '../components/PortalAvatarControls';
import { PersonalZodiacMark } from '../auth/BirthdayFeature';
// ljinglePortalAvatarMobileR1
import { socialApi } from '../services/socialApi';
import {
  buildDirectPayloadForCandidate,
  directJingleTitle,
  hasPortableCollectionPackage,
  importDirectSocialCollection,
  importSocialMemoryCapsule,
  isSocialMemoryCapsuleLocked,
  isSocialMemoryCapsuleSnapshot,
} from '../services/socialDirectSend';
// ljinglePortalDirectSendTrueCapsuleR2:screen
import {
  forgetReceivedJingleOpened,
  getOpenedReceivedJingleIds,
  markReceivedJingleOpened,
} from '../services/receivedJingleBoxedState';
import {
  buildSocialProjection,
  importSocialCollection,
  importSocialEntity,
  listPortalShareCandidates,
  setPortalVisibility,
} from '../services/socialProjection';
import { activeAccentColor, colors } from '../theme/colors';
import { themeInkOn } from '../theme/themeColorUtils';
import type { RootStackParamList } from '../types/navigation';
import type {
  PortalShareCandidate,
  ReceivedJingle,
  SocialProfile,
  SocialSearchResult,
} from '../types/social';
import { semanticFeedback } from '../utils/semanticFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'JingleNetwork'>;
// portalBoxedReceivedR4
type Tab = 'PEOPLE' | 'RECEIVED' | 'MINE';

const kindLabels = {
  BOOK: 'KNJIGA',
  MEDIA: 'FILM / SERIJA',
  GAME: 'IGRA',
  COLLECTION: 'KOLEKCIJA',
  ENTRY: 'ZAPIS',
  // ljinglePortalCleanMineSharedEntriesR1
  CAPSULE: 'MEMORY CAPSULE',
} as const;

export function JingleNetworkScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('PEOPLE');
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [discoverable, setDiscoverable] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialSearchResult[]>([]);
  const [inbox, setInbox] = useState<ReceivedJingle[]>([]);
  const [candidates, setCandidates] = useState<PortalShareCandidate[]>([]);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [directSendTarget, setDirectSendTarget] = useState<{
    candidate: PortalShareCandidate;
    requestId: string;
  } | null>(null);
  const [boxedTarget, setBoxedTarget] = useState<ReceivedJingle | null>(null);
  const [openedJingleIds, setOpenedJingleIds] = useState<Set<string>>(
    () => new Set(),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [{ profile: nextProfile }, received, localCandidates] = await Promise.all([
        socialApi.me(),
        socialApi.received(),
        listPortalShareCandidates(),
      ]);
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setBio(nextProfile.bio || '');
      setDiscoverable(nextProfile.discoverable);
      setInbox(received.jingles);
      setOpenedJingleIds(await getOpenedReceivedJingleIds());
      setCandidates(localCandidates);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Jingle Portal nije dostupan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    const clean = query.trim();
    if (tab !== 'PEOPLE' || clean.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void socialApi.search(clean, 40)
        .then(({ results: found }) => { if (!cancelled) setResults(found); })
        .catch((caught) => { if (!cancelled) setMessage(caught instanceof Error ? caught.message : 'Pretraga nije uspjela.'); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 280);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, tab]);

  const filteredCandidates = useMemo(() => {
    const q = candidateQuery.trim().toLocaleLowerCase();
    if (!q) {
      // Keep Moj Portal quiet: every collection is directly manageable, while
      // individual catalogue things and Entries appear only after selection.
      return candidates.filter((item) =>
        item.kind === 'COLLECTION' ||
        item.kind === 'CAPSULE' ||
        item.visible,
      );
    }
    return candidates.filter((item) =>
      (item.title + ' ' + (item.subtitle || '') + ' ' + kindLabels[item.kind])
        .toLocaleLowerCase()
        .includes(q),
    );
  }, [candidateQuery, candidates]);

  const saveProfile = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await socialApi.updateProfile({
        displayName: displayName.trim() || user?.username || 'LJingle',
        bio: bio.trim() || null,
        discoverable,
      });
      setProfile(result.profile);
      setMessage('Profil spremljen.');
      void semanticFeedback.complete();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Profil nije spremljen.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const projection = await buildSocialProjection();
      const result = await socialApi.publishProjection(projection);
      setProfile(result.profile);
      setMessage(
        'Portal je objavljen · ' + projection.collections.length + ' kolekcija · ' +
        projection.entries.length + ' zapisa · ' + projection.entities.length + ' pojedinačnih stvari.',
      );
      void semanticFeedback.complete();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Portal nije objavljen.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCandidate = async (candidate: PortalShareCandidate) => {
    if (candidate.kind === 'CAPSULE') return;
    const next = !candidate.visible;
    setCandidates((current) => current.map((item) => item.kind === candidate.kind && item.id === candidate.id ? { ...item, visible: next } : item));
    try {
      await setPortalVisibility(candidate.kind, candidate.id, next);
      void semanticFeedback.selection();
    } catch (caught) {
      setCandidates((current) => current.map((item) => item.kind === candidate.kind && item.id === candidate.id ? { ...item, visible: candidate.visible } : item));
      setMessage(caught instanceof Error ? caught.message : 'Vidljivost nije spremljena.');
    }
  }

  const chooseDirectSend = (candidate: PortalShareCandidate) => {
    if (candidate.kind === 'ENTRY') {
      setMessage('Direct send za Zapise još nije omogućen; Memory Box / Capsule i katalog stvari jesu.');
      return;
    }
    setDirectSendTarget({
      candidate,
      requestId:
        'portal-send-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 10),
    });
    setMessage(null);
    setQuery('');
    setResults([]);
    setTab('PEOPLE');
    void semanticFeedback.selection();
  };

  const sendDirectToPerson = async (person: SocialProfile) => {
    const selected = directSendTarget;
    if (!selected || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const payload = await buildDirectPayloadForCandidate(selected.candidate);
      await socialApi.sendJingle({
        recipientUsername: person.username,
        entityType: payload.entityType,
        entity: payload.entity,
        message: null,
        clientRequestId: selected.requestId,
      });
      setDirectSendTarget(null);
      setQuery('');
      setResults([]);
      setTab('MINE');
      setMessage('Poslano u @' + person.username + ' Jingle.');
      void semanticFeedback.complete();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Jingle nije poslan.');
    } finally {
      setBusy(false);
    }
  };;

  const showBoxedJingle = (jingle: ReceivedJingle) => {
    if (busy) return;
    if (
      jingle.entityType === 'CAPSULE' &&
      isSocialMemoryCapsuleLocked(jingle.entity)
    ) {
      const openOn =
        isSocialMemoryCapsuleSnapshot(jingle.entity)
          ? jingle.entity.openOn
          : null;
      setMessage(
        'Ova Memory Capsule je zapečaćena' +
          (openOn ? ' do ' + openOn : '') +
          '.',
      );
      return;
    }
    setBoxedTarget(jingle);
  };

  const completeBoxedReveal = async () => {
    const target = boxedTarget;
    if (!target) return;

    try {
      await markReceivedJingleOpened(target.id);
    } catch {
      setMessage('Jingle je otvoren, ali lokalni open-state nije spremljen.');
    }

    setOpenedJingleIds((current) => {
      const next = new Set(current);
      next.add(target.id);
      return next;
    });
    setBoxedTarget(null);
  };

  const acceptJingle = async (jingle: ReceivedJingle) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (
        jingle.entityType === 'CAPSULE' &&
        isSocialMemoryCapsuleSnapshot(jingle.entity)
      ) {
        await importSocialMemoryCapsule(jingle.entity);
      } else if (
        jingle.entityType === 'COLLECTION' &&
        'name' in jingle.entity
      ) {
        if (hasPortableCollectionPackage(jingle.entity)) {
          await importDirectSocialCollection(jingle.entity);
        } else {
          await importSocialCollection(jingle.entity);
        }
      } else if (
        'kind' in jingle.entity &&
        'title' in jingle.entity
      ) {
        await importSocialEntity(jingle.entity);
      }
      await socialApi.setJingleStatus(jingle.id, 'ACCEPTED');
      await forgetReceivedJingleOpened(jingle.id).catch(() => undefined);
      setOpenedJingleIds((current) => {
        const next = new Set(current);
        next.delete(jingle.id);
        return next;
      });
      setInbox((current) => current.filter((item) => item.id !== jingle.id));
      setMessage('Dodano u tvoj katalog. Tuđi status i osobni podaci nisu kopirani.');
      void semanticFeedback.complete();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Jingle nije uvezen.');
    } finally {
      setBusy(false);
    }
  };

  const dismissJingle = async (jingle: ReceivedJingle) => {
    if (busy) return;
    setBusy(true);
    try {
      await socialApi.setJingleStatus(jingle.id, 'DISMISSED');
      await forgetReceivedJingleOpened(jingle.id).catch(() => undefined);
      setOpenedJingleIds((current) => {
        const next = new Set(current);
        next.delete(jingle.id);
        return next;
      });
      setInbox((current) => current.filter((item) => item.id !== jingle.id));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Jingle nije uklonjen.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.loading}>Otvaram Portal…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.constellation}><Text style={styles.heroStar}>✦</Text><View style={styles.line} /><Text style={styles.heroStar}>✧</Text></View>
          <JingleBellIcon active style={styles.heroBell} />
          <Text style={styles.eyebrow}>THE SHARED WORLD</Text>
          <Text style={styles.heroTitle}>Jingle Portal</Text>
          <Text style={styles.heroSubtitle}>Drugi mali arhivi postoje ovdje. Bez feeda. Bez buke.</Text>
        </View>

        <View style={styles.tabs}>
          {([
            ['PEOPLE', 'Ljudi'],
            ['RECEIVED', 'Primljeno' + (inbox.length ? ' · ' + inbox.length : '')],
            ['MINE', 'Moj Portal'],
          ] as Array<[Tab, string]>).map(([value, label]) => (
            <Pressable key={value} onPress={() => {
              if (value !== 'PEOPLE') setDirectSendTarget(null);
              setTab(value);
            }} style={[styles.tab, tab === value && styles.tabActive]}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}

        {tab === 'PEOPLE' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {directSendTarget
                ? 'SLANJE · ' + directSendTarget.candidate.title
                : 'SEARCH THE NETWORK'}
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder={
                directSendTarget
                  ? 'Pronađi osobu kojoj šalješ…'
                  : 'Search people, collections, shared things…'
              }
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              value={query}
            />
            {searching ? <ActivityIndicator color={colors.gold} style={styles.searchLoader} /> : null}
            {!query.trim() ? <Text style={styles.quiet}>Upiši username, ime ili naslov.</Text> : null}
            {results
              .filter(
                (result) =>
                  !directSendTarget ||
                  result.kind === 'PERSON',
              )
              .map((result) => {
              const username = result.kind === 'PERSON' ? result.profile.username : result.owner.username;
              const title = result.kind === 'PERSON'
                ? result.profile.displayName
                : result.kind === 'REMOTE_ENTITY'
                  ? result.entity.title
                  : result.kind === 'REMOTE_ENTRY'
                    ? (result.entry.title || result.entry.content.slice(0, 80) || 'Zapis')
                    : result.collection.name;
              const meta = result.kind === 'PERSON'
                ? '@' + result.profile.username + ' · ' + result.profile.counts.entities + ' stvari · ' + (result.profile.counts.entries ?? 0) + ' zapisa'
                : result.kind === 'REMOTE_ENTITY'
                  ? kindLabels[result.entity.kind] + ' · @' + result.owner.username
                  : result.kind === 'REMOTE_ENTRY'
                    ? 'ZAPIS · @' + result.owner.username
                    : 'KOLEKCIJA · @' + result.owner.username;
              return (
                <Pressable
                  key={result.key}
                  onPress={() => {
                    if (directSendTarget && result.kind === 'PERSON') {
                      void sendDirectToPerson(result.profile);
                      return;
                    }
                    navigation.navigate('JingleProfile', { username });
                  }}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                >
                  <View style={styles.resultMark}><Text style={styles.resultMarkText}>{result.kind === 'PERSON' ? '@' : result.kind === 'REMOTE_COLLECTION' ? '✧' : result.kind === 'REMOTE_ENTRY' ? '“' : '◇'}</Text></View>
                  <View style={styles.resultCopy}><Text style={styles.resultTitle}>{title}</Text><Text style={styles.resultMeta}>{meta}</Text></View>
                  <Text style={styles.resultArrow}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {tab === 'RECEIVED' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECEIVED JINGLES</Text>
            {inbox.length === 0 ? (
              <Text style={styles.quiet}>
                Ništa ne čeka. Kad ti netko nešto pošalje, pojavit će se ovdje.
              </Text>
            ) : null}

            {inbox.map((jingle) => {
              // ljingleReceivedMemoryBoxOpeningR1
              // Collections are LJINGLE Memory Boxes. Only those use the
              // sealed opening ritual; ordinary direct Jingles stay ordinary.
              const boxedDelivery =
                jingle.entityType === 'COLLECTION' ||
                jingle.entityType === 'CAPSULE';
              const opened =
                !boxedDelivery ||
                openedJingleIds.has(jingle.id);
              const title =
                'name' in jingle.entity
                  ? jingle.entity.name
                  : jingle.entity.title;

              if (!opened) {
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      'Otvori LJINGLE BOXED od ' + jingle.sender.displayName
                    }
                    disabled={busy}
                    key={jingle.id}
                    onPress={() => showBoxedJingle(jingle)}
                    style={({ pressed }) => [
                      styles.boxedJingleCard,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <View style={styles.boxedIcon}>
                      <CollectionMemoryBoxGlyph
                        color={themeInkOn(activeAccentColor)}
                        size={43}
                      />
                      <View style={styles.boxedSeal}>
                        <Text style={styles.boxedSealText}>✦</Text>
                      </View>
                    </View>

                    <View style={styles.boxedCopy}>
                      <Text style={styles.boxedEyebrow}>
                        LJINGLE BOXED · SEALED
                      </Text>
                      <Text numberOfLines={2} style={styles.boxedFrom}>
                        From {jingle.sender.displayName}
                      </Text>
                      <Text style={styles.boxedMeta}>
                        @{jingle.sender.username} · {
                          jingle.entityType === 'CAPSULE' &&
                          isSocialMemoryCapsuleSnapshot(jingle.entity) &&
                          isSocialMemoryCapsuleLocked(jingle.entity)
                            ? 'OTVARA SE ' + (jingle.entity.openOn || '')
                            : 'TAP TO OPEN'
                        }
                      </Text>
                    </View>

                    <Text style={styles.boxedArrow}>›</Text>
                  </Pressable>
                );
              }

              return (
                <View key={jingle.id} style={styles.jingleCard}>
                  <Text style={styles.openedStamp}>LJINGLE BOXED · OPENED</Text>
                  <Text style={styles.sentBy}>
                    🔔 {jingle.sender.displayName} · @{jingle.sender.username}
                  </Text>
                  <Text style={styles.jingleTitle}>{title}</Text>
                  <Text style={styles.jingleKind}>
                    {kindLabels[jingle.entityType]}
                  </Text>
                  {jingle.message ? (
                    <Text style={styles.jingleMessage}>
                      “{jingle.message}”
                    </Text>
                  ) : null}
                  <View style={styles.jingleActions}>
                    <Pressable
                      disabled={busy}
                      onPress={() => void acceptJingle(jingle)}
                      style={styles.accept}
                    >
                      <Text style={styles.acceptText}>Dodaj u moj katalog</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => void dismissJingle(jingle)}
                      style={styles.dismiss}
                    >
                      <Text style={styles.dismissText}>Odbaci</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'MINE' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MY PORTAL</Text>
            <View style={styles.profileCard}>
              <PortalAvatarControls
                disabled={busy}
                onProfileChange={setProfile}
                profile={profile}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Text style={styles.username}>
                  @{profile?.username || user?.username}
                </Text>
                <PersonalZodiacMark />
              </View>
              {/* ljinglePortalPersonalZodiacMarkR1 */}
              <TextInput maxLength={80} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor={colors.textMuted} style={styles.profileInput} value={displayName} />
              <TextInput maxLength={240} multiline onChangeText={setBio} placeholder="Jedna rečenica o tvom arhivu…" placeholderTextColor={colors.textMuted} style={[styles.profileInput, styles.bio]} value={bio} />
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}><Text style={styles.switchTitle}>Discoverable on Jingle Portal</Text><Text style={styles.switchDetail}>Isključeno znači da te ljudi i search ne mogu pronaći.</Text></View>
                <Switch value={discoverable} onValueChange={setDiscoverable} trackColor={{ false: colors.fillStrong, true: colors.goldSoft }} thumbColor={discoverable ? colors.navy : colors.white} />
              </View>
              <Pressable disabled={busy} onPress={() => void saveProfile()} style={styles.outlineButton}><Text style={styles.outlineButtonText}>Spremi profil</Text></Pressable>
            </View>

            <Text style={[styles.sectionLabel, styles.visibilityLabel]}>WHAT OTHERS MAY SEE</Text>
            <Text style={styles.privacyCopy}>Sve je privatno dok ga ovdje ne uključiš. Kolekcije su uvijek na popisu; pojedinačne stvari i Zapise pronađi searchom. Sessioni, reader dokumenti, privatne veze i sync snapshotovi se ne objavljuju. Tapni red za slanje; kućica samo kontrolira što je javno na Portalu.</Text>
            <TextInput onChangeText={setCandidateQuery} placeholder="Pronađi kolekciju, stvar ili Zapis…" placeholderTextColor={colors.textMuted} style={styles.search} value={candidateQuery} />
            {!candidateQuery.trim() && candidates.length > filteredCandidates.length ? (
              <Text style={styles.candidateHint}>Prikazane su sve kolekcije i već odabrane stvari/Zapisi. Search prolazi kroz cijeli arhiv ({candidates.length}).</Text>
            ) : null}
            {filteredCandidates.map((candidate) => (
              <Pressable
                key={candidate.kind + ':' + candidate.id}
                accessibilityRole="button"
                onPress={() => chooseDirectSend(candidate)}
                style={styles.candidate}
              >
                {candidate.kind === 'CAPSULE' ? (
                  <View style={[styles.check, styles.checkOn]}>
                    <Text style={styles.checkText}>✦</Text>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: candidate.visible }}
                    onPress={(event) => {
                      event.stopPropagation();
                      void toggleCandidate(candidate);
                    }}
                    style={[styles.check, candidate.visible && styles.checkOn]}
                  >
                    {candidate.visible ? (
                      <Text style={styles.checkText}>✓</Text>
                    ) : null}
                  </Pressable>
                )}
                <View style={styles.resultCopy}>
                  <Text style={styles.resultTitle}>{candidate.title}</Text>
                  <Text style={styles.resultMeta}>
                    {kindLabels[candidate.kind]}
                    {candidate.subtitle ? ' · ' + candidate.subtitle : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable disabled={busy} onPress={() => void publish()} style={[styles.publish, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.goldSoft} /> : <><JingleBellIcon active style={styles.publishBell} /><Text style={styles.publishText}>Objavi promjene u Portal</Text></>}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <LjingleBoxedReveal
        actionLabel={
          boxedTarget?.entityType === 'CAPSULE'
            ? 'OTVORI KAPSULU'
            : 'OPEN LJINGLE'
        }
        label={
          boxedTarget?.entityType === 'CAPSULE'
            ? 'MEMORY CAPSULE'
            : 'LJINGLE BOXED'
        }
        onOpened={completeBoxedReveal}
        onRequestClose={() => setBoxedTarget(null)}
        subtitle={
          boxedTarget
            ? 'Something from @' + boxedTarget.sender.username + ' is sealed inside.'
            : 'Something is sealed inside.'
        }
        title={
          boxedTarget
            ? boxedTarget.entityType === 'CAPSULE'
              ? directJingleTitle(boxedTarget.entity)
              : 'A Jingle from ' + boxedTarget.sender.displayName
            : 'A Jingle is waiting'
        }
        visible={Boolean(boxedTarget)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { marginTop: 12, color: colors.textMuted },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, backgroundColor: colors.fillStrong },
  constellation: { position: 'absolute', left: 24, right: 24, top: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: 0.35 },
  line: { width: 92, height: StyleSheet.hairlineWidth, backgroundColor: colors.gold, marginHorizontal: 10, transform: [{ rotate: '-5deg' }] },
  heroStar: { color: colors.gold, fontSize: 13 },
  heroBell: { width: 50, height: 50 },
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.7, marginTop: 9 },
  heroTitle: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },
  heroSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 380 },
  tabs: { flexDirection: 'row', gap: 8, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  tab: { flex: 1, minHeight: 40, borderRadius: 13, borderWidth: 1, borderColor: colors.separator, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.gold },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.goldSoft },
  section: { paddingHorizontal: 18, paddingTop: 18 },
  sectionLabel: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.1, marginBottom: 10 },
  search: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, fontSize: 14 },
  searchLoader: { marginTop: 16 },
  quiet: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 26 },
  resultRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  resultMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  resultMarkText: { color: colors.goldSoft, fontSize: 15, fontWeight: '900' },
  resultCopy: { flex: 1, marginLeft: 12 },
  resultTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  resultMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  resultArrow: { color: colors.gold, fontSize: 25 },
  pressed: { opacity: 0.62 },
  message: { marginHorizontal: 18, marginTop: 14, borderRadius: 13, padding: 12, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.separator },
  messageText: { color: colors.text, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  boxedJingleCard: {
    minHeight: 126,
    marginBottom: 14,
    padding: 16,
    paddingRight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  boxedIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: activeAccentColor,
  },
  boxedSeal: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  boxedSealText: {
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
  },
  boxedCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 15,
  },
  boxedEyebrow: {
    color: activeAccentColor,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.55,
  },
  boxedFrom: {
    marginTop: 6,
    color: colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  boxedMeta: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  boxedArrow: {
    position: 'absolute',
    right: 17,
    color: activeAccentColor,
    fontSize: 28,
    fontWeight: '300',
  },
  openedStamp: {
    color: activeAccentColor,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.25,
    marginBottom: 8,
  },
  jingleCard: { marginBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, padding: 17 },
  sentBy: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  jingleTitle: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 9 },
  jingleKind: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 4 },
  jingleMessage: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 21, marginTop: 14 },
  jingleActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  accept: { flex: 1, minHeight: 43, borderRadius: 13, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: colors.goldSoft, fontSize: 11, fontWeight: '900' },
  dismiss: { minHeight: 43, paddingHorizontal: 15, borderRadius: 13, borderWidth: 1, borderColor: colors.separator, alignItems: 'center', justifyContent: 'center' },
  dismissText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  profileCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, padding: 16 },
  username: { color: colors.gold, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  profileInput: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, color: colors.text, fontSize: 16, paddingVertical: 10 },
  bio: { minHeight: 70, textAlignVertical: 'top', fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  switchCopy: { flex: 1 },
  switchTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  switchDetail: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  outlineButton: { minHeight: 43, borderRadius: 13, borderWidth: 1, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  visibilityLabel: { marginTop: 25 },
  privacyCopy: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 13 },
  candidate: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  candidateHint: { color: colors.textMuted, fontSize: 10, lineHeight: 15, paddingHorizontal: 4, paddingTop: 10 },
  check: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: colors.separator, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.navy, borderColor: colors.gold },
  checkText: { color: colors.goldSoft, fontSize: 13, fontWeight: '900' },
  publish: { minHeight: 52, borderRadius: 16, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.gold, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  publishBell: { width: 23, height: 23 },
  publishText: { color: colors.goldSoft, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.52 },
});

// ljinglePortalPersonalZodiacMarkR1
