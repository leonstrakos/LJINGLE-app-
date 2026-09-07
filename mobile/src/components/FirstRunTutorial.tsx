// ljingleTutorialFeatureTourV2
// ljingleTutorialMartyAeroRestoreR1:tutorial
// ljingleTutorialNewFeaturesR3
// ljingleTutorialJingleBrainR6
// ljingleTutorialJungReaderBrainFeaturesR2
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  finishOnboarding,
  getOnboardingState,
  shouldShowFirstRunTutorial,
} from '../services/onboardingExperience';
import { JingleBellIcon } from './JingleBellIcon';

type Props = {
  auto?: boolean;
  visible?: boolean;
  onClose?: () => void;
};

const STEPS = [
  {
    eyebrow: 'FIRST SIGNAL',
    title: 'LJingle pamti veze.',
    body: 'Katalog, vrijeme, Zapisi, teme, kolekcije i glazba nisu odvojeni otoci. LJingle ih čuva kao dijelove iste osobne povijesti.',
    kind: 'graph',
  },
  {
    eyebrow: 'KATALOG',
    title: 'Sve što pratiš, na jednom mjestu.',
    body: 'Knjige, filmovi, serije i igre imaju vlastite statuse i napredak. Jingle je zaseban znak: status govori gdje si stao, Jingle što ti je važno.',
    kind: 'catalogue',
  },
  {
    eyebrow: 'JINGLE BRAIN',
    title: 'Brain razumije veze u tvom arhivu.',
    body: 'Brain kombinira fuzzy/full-text i semantičku pretragu s vezama arhiva. Pitaj “zapisi povezani s Jungom / notes connected to Jung” ili iz otvorene stvari “što još imam o ovome? / what else do I have about this?”. Rezultat pokazuje zašto je pronađen. Zatim možeš nastaviti “samo zapisi / only entries”, “iz knjiga / from books” ili “ne u Dreams / not in Dreams”. Bulk naredbe prvo daju PLAN, a Memory Box mijenjaju tek nakon POTVRDA / CONFIRM.',
    kind: 'brain',
  },
  {
    eyebrow: 'TIMERI I SESIJE',
    title: 'Vrijeme postaje dio arhiva.',
    body: 'Quick Timer mjeri bilo koju sesiju, a knjige i aktivnosti mogu imati vlastite timere. Završene sesije ostaju u Povijesti i ulaze u statistiku vremena.',
    kind: 'timer',
  },
  {
    eyebrow: 'KNJIGE I READER',
    title: 'Knjiga može živjeti unutar LJinglea.',
    body: 'Uz knjigu spremi PDF ili EPUB i otvori ga izravno u Readeru. Reader pamti stranicu ili poziciju, napredak i bookmarke, a citat ili bilješku može vratiti na točno mjesto u knjizi.',
    kind: 'reader',
  },
  {
    eyebrow: 'ZAPISI I VEZE',
    title: 'Sačuvaj razlog, ne samo naslov.',
    body: 'Zapis može biti bilješka, citat ili opažanje. Poveži ga s knjigom, filmom, igrom, frekvencijom ili drugim dijelom arhiva i sačuvaj kontekst.',
    kind: 'entry',
  },
  {
    eyebrow: 'GALERIJA · ZAPISI',
    title: 'Slike postaju vizualni album.',
    body: 'Kad Zapis ima slike, Gallery ih pretvara u vizualni tok. Odaberi Memory Box i isti prikaz postaje album te kutije; dodir na sliku vraća te u izvorni Zapis.',
    kind: 'gallery',
  },
  {
    eyebrow: 'TEME',
    title: 'Tema okuplja aktivnosti i vrijeme.',
    body: 'U Temi možeš složiti aktivnosti poput čitanja, istraživanja, rada ili vježbanja. Svaka može imati svoj timer, a Tema zbraja vrijeme koje si joj stvarno posvetio.',
    kind: 'topic',
  },
  {
    eyebrow: 'KOLEKCIJE · MEMORY BOX',
    title: 'Miješaj različite stvari u jednu cjelinu.',
    body: 'Jedan Memory Box može sadržavati knjige, filmove, igre, Teme, Zapise i Frekvencije. Memory Boxeve zatim možeš grupirati u Big Box bez mijenjanja ili brisanja njihovog sadržaja.',
    kind: 'collection',
  },
  {
    eyebrow: 'MEMORY CAPSULE',
    title: 'Spakiraj sada. Otvori kasnije.',
    body: 'U kapsulu spremi stvari, slike i cijele Memory Boxeve. Kad završiš pakiranje, kapsula se zapečati; s datumom ostaje zaključana do tog dana, a nakon otvaranja ostaje read-only arhiv.',
    kind: 'capsule',
  },
  {
    eyebrow: 'PLAYLISTE',
    title: 'Kolekcija može postati redoslijed slušanja.',
    body: 'Kad kolekcija sadrži Frekvencije, njihov redoslijed postaje playlist order u Memory Radiju. Ista kolekcija zato može biti i Memory Box i playlist.',
    kind: 'playlist',
  },
  {
    eyebrow: 'MEMORY RADIO',
    title: 'Sjećanje dobiva svoj zvuk.',
    body: 'Dodaj lokalni audio kao Frekvenciju, poveži ga sa Zapisima ili drugim stvarima i slušaj kroz cijeli app. Player nastavlja raditi dok se krećeš kroz LJingle.',
    kind: 'radio',
  },
  {
    eyebrow: 'TEME I PRIKAZ',
    title: 'Isti arhiv, tvoj način gledanja.',
    body: 'Classic i Aero MAX mijenjaju cijelu atmosferu LJinglea. Aero zatim možeš prebaciti između Ocean i Meadow svijeta bez promjene ijednog podatka u arhivu.',
    kind: 'theme',
  },
  {
    eyebrow: 'POVIJEST I STATISTIKA',
    title: 'Arhiv s vremenom počinje govoriti natrag.',
    body: 'Povijest čuva sesije i njihov kontekst. Statistika pokazuje vrijeme, veličinu kataloga i Neto — odnos onoga što dodaješ prema onome što završavaš ili napuštaš.',
    kind: 'stats',
  },
  {
    eyebrow: 'PORTAL · PROFIL',
    title: 'Dijeli samo ono što izabereš.',
    body: 'Moj Portal je tvoja javna vitrina: pojedinačne stvari i Zapise objavljuješ izričito, a search pronalazi ljude i javni sadržaj. Profil pokazuje objavljeno — ne privatne veze, sessione ni Reader podatke.',
    kind: 'profile',
  },
  {
    eyebrow: 'JINGLEPORTAL',
    title: 'Zvono je tvoj ulaz.',
    body: 'Dodir zvona otvara Jingleportal, a držanje te vraća na Početnu. Portal okuplja brzi pristup arhivu i Now Playing kontrolama dok Memory Radio svira.',
    kind: 'portal',
  },
] as const;

function TutorialBrainGlyph({
  color = GOLD,
}: {
  color?: string;
}) {
  const activeColor = color;
  const stroke = 1.45;

  return (
    <View
      style={{
        width: 25,
        height: 22,
        position: 'relative',
      }}
    >
      {/* Same two-hemisphere geometry as the live Jingle Brain symbol. */}
      <View
        style={{
          position: 'absolute',
          left: 2,
          top: 2,
          width: 10.5,
          height: 18,
          borderWidth: stroke,
          borderRightWidth: stroke * 0.65,
          borderColor: activeColor,
          borderTopLeftRadius: 7,
          borderBottomLeftRadius: 7,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
        }}
      />

      <View
        style={{
          position: 'absolute',
          right: 2,
          top: 2,
          width: 10.5,
          height: 18,
          borderWidth: stroke,
          borderLeftWidth: stroke * 0.65,
          borderColor: activeColor,
          borderTopRightRadius: 7,
          borderBottomRightRadius: 7,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        }}
      />

      {/* central sulcus */}
      <View
        style={{
          position: 'absolute',
          left: 12,
          top: 4,
          width: 1,
          height: 14,
          borderRadius: 1,
          backgroundColor: activeColor,
          opacity: 0.72,
        }}
      />

      {/* quiet gyri */}
      <View style={{ position: 'absolute', left: 4.5, top: 6, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', left: 5.5, top: 11, width: 4, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', left: 4.5, top: 15.5, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />

      <View style={{ position: 'absolute', right: 4.5, top: 6, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', right: 5.5, top: 11, width: 4, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', right: 4.5, top: 15.5, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
    </View>
  );
}

function StepVisual({ kind }: { kind: (typeof STEPS)[number]['kind'] }) {
  if (kind === 'graph') {
    return (
      <View style={styles.graph}>
        <View style={[styles.graphNode, styles.graphTop]}>
          <Text style={styles.nodeKicker}>FILM</Text>
          <Text style={styles.nodeTitle}>Marty Supreme</Text>
        </View>
        <View style={[styles.graphLine, styles.graphLineOne]} />
        <View style={[styles.graphNode, styles.graphLeft]}>
          <Text style={styles.nodeKicker}>QUOTE</Text>
          <Text style={styles.nodeTitle}>A purpose</Text>
        </View>
        <View style={[styles.graphLine, styles.graphLineTwo]} />
        <View style={[styles.graphNode, styles.graphRight]}>
          <Text style={styles.nodeKicker}>FREQUENCY</Text>
          <Text style={styles.nodeTitle}>Forever Young</Text>
        </View>
        <Text style={styles.graphStar}>✦</Text>
      </View>
    );
  }

  if (kind === 'brain') {
    return (
      <View style={styles.brainVisual}>
        <View style={styles.brainHeroRow}>
          <View style={styles.brainGlyphHalo}>
            <View style={styles.brainGlyphScale}>
              <TutorialBrainGlyph />
            </View>
          </View>

          <View style={styles.brainHeroCopy}>
            <Text style={styles.brainHeroKicker}>
              JINGLE BRAIN
            </Text>
            <Text style={styles.brainHeroTitle}>
              Arhiv razumije veze.
            </Text>
          </View>
        </View>

        <View style={styles.brainSearchBox}>
          <Text style={styles.brainSearchPrompt}>⌕</Text>
          <Text
            numberOfLines={2}
            style={styles.brainSearchText}
          >
            zapisi povezani s Jungom / notes connected to Jung
          </Text>

          <View style={styles.brainMiniIcon}>
            <TutorialBrainGlyph />
          </View>
        </View>

        <View style={styles.brainResultCard}>
          <View style={styles.brainResultHead}>
            <Text style={styles.brainResultKind}>
              ZAPIS
            </Text>
            <Text style={styles.brainResultScore}>
              WHY THIS RESULT
            </Text>
          </View>

          <Text style={styles.brainResultTitle}>
            Dreams and Symbols
          </Text>

          <Text
            numberOfLines={2}
            style={styles.brainResultExcerpt}
          >
            Povezano s knjigom · Related to book
          </Text>

          <View style={styles.brainProvenance}>
            <Text style={styles.brainProvenanceText}>
              READER · JUNG · STR. 83
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={styles.brainResultExcerpt}
          >
            FOLLOW-UP · samo zapisi / only entries · iz knjiga / from books
          </Text>

          <Text
            numberOfLines={2}
            style={styles.brainResultExcerpt}
          >
            CURRENT · što još imam o ovome? / what else do I have about this?
          </Text>

          <Text
            numberOfLines={2}
            style={styles.brainResultExcerpt}
          >
            BULK · PLAN → POTVRDA / CONFIRM
          </Text>
        </View>

        <View style={styles.brainLanes}>
          <Text style={styles.brainLane}>
            FUZZY
          </Text>
          <Text style={styles.brainLaneDot}>·</Text>
          <Text style={styles.brainLane}>
            FULL TEXT
          </Text>
          <Text style={styles.brainLaneDot}>·</Text>
          <Text style={styles.brainLane}>
            SEMANTIC
          </Text>
          <Text style={styles.brainLaneDot}>·</Text>
          <Text style={styles.brainLane}>
            VEZE
          </Text>
        </View>
      </View>
    );
  }

  if (kind === 'catalogue') {
    return (
      <View style={styles.stackVisual}>
        <View style={styles.mockRow}><Text style={styles.mockMark}>▣</Text><Text style={styles.mockText}>Knjiga</Text><Text style={styles.mockChip}>ČITAM</Text></View>
        <View style={styles.mockRow}><Text style={styles.mockMark}>▷</Text><Text style={styles.mockText}>Film</Text><Text style={styles.mockChip}>ZA POSLIJE</Text></View>
        <View style={styles.mockRow}><Text style={styles.mockMark}>✦</Text><Text style={styles.mockText}>Jingle</Text><Text style={styles.mockBell}>●</Text></View>
      </View>
    );
  }

  if (kind === 'timer') {
    return (
      <View style={styles.timerVisual}>
        <Text style={styles.timerClock}>00:42:18</Text>
        <Text style={styles.timerMeta}>DANAS · AKTIVNA SESIJA</Text>
        <View style={styles.timerRows}>
          <View style={styles.timerRow}><Text style={styles.timerRowMark}>≡</Text><Text style={styles.timerRowText}>Čitanje</Text><Text style={styles.timerRowState}>RUNNING</Text></View>
          <View style={styles.timerRow}><Text style={styles.timerRowMark}>⌕</Text><Text style={styles.timerRowText}>Istraživanje</Text><Text style={styles.timerRowState}>12:06</Text></View>
        </View>
      </View>
    );
  }

  if (kind === 'reader') {
    return (
      <View style={styles.readerVisual}>
        <View style={styles.readerDemoTop}>
          <View style={styles.readerDemoPoster}>
            <Text style={styles.readerDemoPosterMark}>
              JUNG
            </Text>
          </View>

          <View style={styles.readerDemoCopy}>
            <Text style={styles.readerDemoKicker}>
              PDF · CARL G. JUNG
            </Text>
            <Text style={styles.readerDemoTitle}>
              Man and His Symbols
            </Text>
            <Text style={styles.readerDemoMeta}>
              PDF Reader · str. 83 · bookmark
            </Text>
          </View>
        </View>

        <View style={styles.readerDemoQuote}>
          <Text style={styles.readerDemoQuoteMark}>
            “
          </Text>
          <Text style={styles.readerDemoQuoteText}>
            Dream images can carry recurring symbols and associations…
          </Text>
        </View>

        <View style={styles.readerDemoFooter}>
          <Text style={styles.readerDemoFooterText}>
            PDF · STR. 83 · BOOKMARK
          </Text>

          <View style={styles.readerQuoteButton}>
            <Text style={styles.readerQuoteButtonText}>
              ＋ CITAT
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (kind === 'entry') {
    return (
      <View style={styles.quoteCard}>
        <View style={styles.entrySourceRow}>
          <View style={styles.entrySourceBadge}><Text style={styles.entrySourceBadgeText}>MS</Text></View>
          <View style={styles.entrySourceCopy}>
            <Text style={styles.entrySourceKicker}>MARTY SUPREME</Text>
            <Text style={styles.entrySourceMeta}>FILM · FIRST SIGNAL</Text>
          </View>
        </View>
        <Text style={styles.quoteMark}>“</Text>
        <Text numberOfLines={4} style={styles.quoteText}>
          I have a purpose. You don't. If you think that's some kind of blessing, it's not…
        </Text>
        <View style={styles.linkPill}><Text style={styles.linkPillText}>REMEMBERED WITH · FOREVER YOUNG</Text></View>
      </View>
    );
  }

  if (kind === 'gallery') {
    return (
      <View style={styles.galleryVisual}>
        <View style={styles.galleryTop}>
          <Text style={styles.galleryTitle}>FIRST SIGNAL</Text>
          <View style={styles.galleryFilter}>
            <Text style={styles.galleryFilterText}>MEMORY BOX</Text>
          </View>
        </View>

        <View style={styles.galleryGrid}>
          <View style={[styles.galleryTile, styles.galleryTileDark]}>
            <Text style={styles.galleryTileMark}>MS</Text>
            <Text style={styles.galleryTileMeta}>MARTY</Text>
          </View>
          <View style={[styles.galleryTile, styles.galleryTilePaper]}>
            <Text style={styles.galleryQuoteMark}>“</Text>
            <Text numberOfLines={2} style={styles.galleryQuote}>
              A purpose
            </Text>
          </View>
          <View style={[styles.galleryTile, styles.galleryTilePaper]}>
            <Text style={styles.gallerySpark}>✦</Text>
            <Text style={styles.galleryTileMetaDark}>ZAPIS</Text>
          </View>
          <View style={[styles.galleryTile, styles.galleryTileDark]}>
            <Text style={styles.gallerySparkGold}>✦</Text>
            <Text style={styles.galleryTileMeta}>ALBUM</Text>
          </View>
        </View>
      </View>
    );
  }

  if (kind === 'topic') {
    return (
      <View style={styles.topicVisual}>
        <View style={styles.topicHeader}><Text style={styles.topicTitle}>Consciousness</Text><Text style={styles.topicTotal}>18 H 24 M</Text></View>
        <View style={styles.topicActivities}>
          <View style={styles.topicActivity}><Text style={styles.topicActivityMark}>⌕</Text><Text style={styles.topicActivityText}>Istraživanje</Text><Text style={styles.topicActivityTime}>08:10:42</Text></View>
          <View style={styles.topicActivity}><Text style={styles.topicActivityMark}>≡</Text><Text style={styles.topicActivityText}>Čitanje</Text><Text style={styles.topicActivityTime}>06:33:09</Text></View>
          <View style={styles.topicActivity}><Text style={styles.topicActivityMark}>◇</Text><Text style={styles.topicActivityText}>Učenje</Text><Text style={styles.topicActivityTime}>03:40:09</Text></View>
        </View>
      </View>
    );
  }

  if (kind === 'collection') {
    return (
      <View style={styles.collectionVisual}>
        <Text style={styles.collectionSymbol}>✦</Text>
        <View style={styles.collectionCopy}>
          <Text style={styles.collectionTitle}>First Signal · A Purpose</Text>
          <Text style={styles.collectionMeta}>1 FILM · 1 QUOTE · 1 FREQUENCY</Text>
          <Text style={styles.collectionHint}>Marty Supreme · citat · Forever Young u istoj memorijskoj vezi.</Text>
        </View>
      </View>
    );
  }

  if (kind === 'capsule') {
    return (
      <View style={styles.capsuleVisual}>
        <Text style={styles.capsuleSpark}>✦</Text>
        <Text style={styles.capsuleKicker}>
          LJINGLE BOXED · ZAPEČAĆENO
        </Text>
        <Text style={styles.capsuleTitle}>
          For later
        </Text>
        <View style={styles.capsuleDate}>
          <Text style={styles.capsuleDateLabel}>
            OTVARA SE
          </Text>
          <Text style={styles.capsuleDateValue}>
            14.10.2026.
          </Text>
        </View>
        <Text style={styles.capsuleHint}>
          sadržaj miruje do otvaranja
        </Text>
      </View>
    );
  }

  if (kind === 'playlist') {
    return (
      <View style={styles.playlistVisual}>
        <View style={styles.playlistHeader}><Text style={styles.playlistTitle}>Night Reading</Text><Text style={styles.playlistMeta}>3 FREQUENCIES</Text></View>
        <View style={styles.playlistTrack}><Text style={styles.playlistIndex}>01</Text><Text style={styles.playlistTrackText}>First Signal</Text><Text style={styles.playlistPlay}>▶</Text></View>
        <View style={styles.playlistTrack}><Text style={styles.playlistIndex}>02</Text><Text style={styles.playlistTrackText}>Blue Hour</Text><Text style={styles.playlistPlay}>▶</Text></View>
        <View style={styles.playlistTrack}><Text style={styles.playlistIndex}>03</Text><Text style={styles.playlistTrackText}>Afterimage</Text><Text style={styles.playlistPlay}>▶</Text></View>
      </View>
    );
  }

  if (kind === 'radio') {
    return (
      <View style={styles.playerVisual}>
        <View style={styles.album}><Text style={styles.albumStar}>✦</Text></View>
        <View style={styles.playerCopy}>
          <Text style={styles.playerKicker}>NOW PLAYING</Text>
          <Text style={styles.playerTitle}>Forever Young</Text>
          <Text style={styles.playerArtist}>Alphaville · First Signal</Text>
        </View>
        <View style={styles.playCircle}><Text style={styles.playIcon}>Ⅱ</Text></View>
      </View>
    );
  }

  if (kind === 'theme') {
    return (
      <View style={styles.themeVisual}>
        <View style={[styles.themeCard, styles.themeClassic]}>
          <Text style={styles.themeStar}>✦</Text>
          <Text style={styles.themeClassicText}>CLASSIC</Text>
          <Text style={styles.themeClassicSub}>NAVY · GOLD · PAPER</Text>
        </View>
        <View style={[styles.themeCard, styles.themeAero]}>
          <View style={styles.aeroSun} />
          <View style={styles.aeroBubble} />
          <View style={styles.aeroBubbleSmall} />
          <View style={styles.aeroMeadow} />
          <Text style={styles.themeAeroText}>AERO MAX</Text>
          <Text style={styles.themeAeroSub}>OCEAN · MEADOW</Text>
        </View>
      </View>
    );
  }

  if (kind === 'stats') {
    return (
      <View style={styles.statsVisual}>
        <View style={styles.statsTop}>
          <View style={styles.statsMetric}><Text style={styles.statsMetricValue}>126h</Text><Text style={styles.statsMetricLabel}>ZABILJEŽENO VRIJEME</Text></View>
          <View style={styles.statsMetric}><Text style={styles.statsMetricValue}>418</Text><Text style={styles.statsMetricLabel}>STAVKE U KATALOGU</Text></View>
        </View>
        <View style={styles.netRow}><Text style={styles.netLabel}>NETO · 30 DANA</Text><Text style={styles.netValue}>−12</Text></View>
      </View>
    );
  }

  if (kind === 'profile') {
    return (
      <View style={styles.profileVisual}>
        <View style={styles.profileHead}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>L</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>Leon</Text>
            <Text style={styles.profileHandle}>@leon · JINGLE PROFILE</Text>
          </View>
          <View style={styles.profilePublicChip}>
            <Text style={styles.profilePublicText}>PUBLIC</Text>
          </View>
        </View>

        <View style={styles.profileDivider} />

        <Text style={styles.profileSectionLabel}>
          SHARED ENTRIES
        </Text>

        <View style={styles.profileEntry}>
          <View style={styles.profileEntryHead}>
            <Text style={styles.profileEntryKind}>CITAT</Text>
            <Text style={styles.profileEntryDate}>06.09.</Text>
          </View>
          <Text style={styles.profileEntryTitle}>A purpose</Text>
          <Text numberOfLines={2} style={styles.profileEntryCopy}>
            I have a purpose. You don't.
          </Text>
        </View>

        <Text style={styles.profilePrivacy}>
          samo ono što odlučiš objaviti
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.portalVisual}>
      <View style={styles.portalHalo} />
      <JingleBellIcon active style={styles.portalBell} />
      <Text style={styles.portalGesture}>TAP · PORTAL</Text>
      <Text style={styles.portalGesture}>HOLD · HOME</Text>
    </View>
  );
}

export function FirstRunTutorial({ auto = false, visible, onClose }: Props) {
  const [autoVisible, setAutoVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exampleEverInstalled, setExampleEverInstalled] = useState(false);

  const shown = visible ?? autoVisible;
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (!auto) return;
    let active = true;
    void shouldShowFirstRunTutorial().then((next) => {
      if (active) setAutoVisible(next);
    });
    return () => { active = false; };
  }, [auto]);

  useEffect(() => {
    if (!shown) return;
    setStep(0);
    void getOnboardingState().then((state) => {
      setExampleEverInstalled(state.exampleEverInstalled);
    });
  }, [shown]);

  const progress = useMemo(
    () => STEPS.map((_, index) => index <= step),
    [step],
  );

  const close = () => {
    setAutoVisible(false);
    onClose?.();
  };

  const finish = async (installExample: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await finishOnboarding({ installExample });
      close();
    } finally {
      setBusy(false);
    }
  };

  if (!shown) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => void finish(false)}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <View style={styles.sky} pointerEvents="none">
            <Text style={[styles.star, styles.starOne]}>✦</Text>
            <Text style={[styles.star, styles.starTwo]}>✧</Text>
            <Text style={[styles.star, styles.starThree]}>·</Text>
          </View>

          <View style={styles.topBar}>
            <Text style={styles.wordmark}>LJINGLE</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void finish(false)}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>PRESKOČI</Text>
            </Pressable>
          </View>

          <View style={styles.progress}>
            {progress.map((active, index) => (
              <View key={String(index)} style={[styles.progressDot, active && styles.progressDotActive]} />
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <StepVisual kind={current.kind} />
            <Text style={styles.eyebrow}>{current.eyebrow}</Text>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>

            {last && !exampleEverInstalled ? (
              <View style={styles.exampleNote}>
                <Text style={styles.exampleNoteMark}>✦</Text>
                <Text style={styles.exampleNoteText}>
                  Dodaj “First Signal” u svoj katalog: Marty Supreme, citat “A purpose” i Forever Young. Sve možeš normalno urediti ili obrisati; tutorial ga nikada neće vratiti nakon brisanja.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            {step > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setStep((value) => Math.max(0, value - 1))}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <Text style={styles.backText}>NATRAG</Text>
              </Pressable>
            ) : <View />}

            {last ? (
              <View style={styles.finishActions}>
                {!exampleEverInstalled ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void finish(false)}
                    style={({ pressed }) => [styles.textFinish, pressed && styles.pressed]}
                  >
                    <Text style={styles.textFinishLabel}>BEZ PRIMJERA</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void finish(!exampleEverInstalled)}
                  style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.nextText}>
                      {exampleEverInstalled ? 'ZAVRŠI' : 'DODAJ PRIMJER'}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
                style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
              >
                <Text style={styles.nextText}>DALJE</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const NAVY = '#10264C';
const GOLD = '#C99B3D';
const PAPER = '#FBF7EE';

const styles = StyleSheet.create({
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,12,28,0.76)' },
  card: { width: '100%', maxWidth: 520, maxHeight: '92%', minHeight: 590, overflow: 'hidden', borderRadius: 30, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER, shadowColor: '#000000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.28, shadowRadius: 30, elevation: 22 },
  sky: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  star: { position: 'absolute', color: GOLD, opacity: 0.35 },
  starOne: { top: 92, left: 24, fontSize: 15 },
  starTwo: { top: 156, right: 26, fontSize: 12 },
  starThree: { top: 268, left: 42, fontSize: 20 },
  topBar: { minHeight: 68, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(16,38,76,0.14)' },
  wordmark: { color: NAVY, fontSize: 15, fontWeight: '900', letterSpacing: 4.5 },
  skip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 5 },
  skipText: { color: NAVY, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, opacity: 0.62 },
  progress: { height: 3, flexDirection: 'row', gap: 4, paddingHorizontal: 24, marginTop: 15 },
  progressDot: { flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(16,38,76,0.12)' },
  progressDotActive: { backgroundColor: GOLD },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 18 },
  eyebrow: { marginTop: 24, color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  title: { marginTop: 8, color: NAVY, fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  body: { marginTop: 13, color: 'rgba(16,38,76,0.74)', fontSize: 15, lineHeight: 23 },
  graph: { height: 210, position: 'relative', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,155,61,0.45)', backgroundColor: '#F4EDDF' },
  graphNode: { position: 'absolute', minWidth: 116, maxWidth: 160, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(16,38,76,0.2)', backgroundColor: PAPER, zIndex: 2 },
  graphTop: { alignSelf: 'center', top: 20 },
  graphLeft: { left: 18, bottom: 23 },
  graphRight: { right: 18, bottom: 23 },
  graphLine: { position: 'absolute', height: 1, width: 105, left: '50%', top: 110, backgroundColor: GOLD, opacity: 0.65 },
  graphLineOne: { marginLeft: -98, transform: [{ rotate: '44deg' }] },
  graphLineTwo: { marginLeft: -7, transform: [{ rotate: '-44deg' }] },
  graphStar: { position: 'absolute', left: '50%', top: 96, marginLeft: -8, color: GOLD, fontSize: 16, zIndex: 3 },
  nodeKicker: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  nodeTitle: { marginTop: 3, color: NAVY, fontSize: 12, fontWeight: '800' },
  brainVisual: { minHeight: 238, padding: 15, borderRadius: 22, borderWidth: 1, borderColor: GOLD, backgroundColor: NAVY },
  brainHeroRow: { flexDirection: 'row', alignItems: 'center' },
  brainGlyphHalo: { width: 54, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  brainGlyphScale: { transform: [{ scale: 1.55 }] },
  brainHeroCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  brainHeroKicker: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1.25 },
  brainHeroTitle: { marginTop: 3, color: PAPER, fontSize: 17, fontWeight: '900' },
  brainSearchBox: { minHeight: 44, marginTop: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  brainSearchPrompt: { marginRight: 7, color: GOLD, fontSize: 14, fontWeight: '900' },
  brainSearchText: { flex: 1, color: NAVY, fontSize: 8, lineHeight: 11, fontWeight: '800' },
  brainMiniIcon: { width: 25, marginLeft: 7, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 0.68 }] },
  brainResultCard: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  brainResultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brainResultKind: { color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 1 },
  brainResultScore: { color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 0.7 },
  brainResultTitle: { marginTop: 5, color: NAVY, fontSize: 11, fontWeight: '900' },
  brainResultExcerpt: { marginTop: 3, color: NAVY, fontSize: 8, lineHeight: 11, opacity: 0.72 },
  brainProvenance: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: GOLD },
  brainProvenanceText: { color: GOLD, fontSize: 5.5, fontWeight: '900', letterSpacing: 0.65 },
  brainLanes: { marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brainLane: { color: PAPER, fontSize: 5.5, fontWeight: '900', letterSpacing: 0.65, opacity: 0.68 },
  brainLaneDot: { marginHorizontal: 4, color: GOLD, fontSize: 8, fontWeight: '900' },
  stackVisual: { gap: 9, paddingVertical: 12 },
  mockRow: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(16,38,76,0.16)', backgroundColor: '#FFFFFF' },
  mockMark: { width: 30, color: GOLD, fontSize: 18 },
  mockText: { flex: 1, color: NAVY, fontWeight: '800' },
  mockChip: { color: NAVY, fontSize: 8, fontWeight: '900', letterSpacing: 0.7, borderRadius: 99, borderWidth: 1, borderColor: GOLD, paddingHorizontal: 9, paddingVertical: 6 },
  mockBell: { color: GOLD, fontSize: 15 },
  quoteCard: { minHeight: 210, padding: 22, borderRadius: 22, backgroundColor: NAVY },
  quoteMark: { color: GOLD, fontSize: 46, lineHeight: 42 },
  quoteText: { color: PAPER, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  linkPill: { alignSelf: 'flex-start', marginTop: 18, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(201,155,61,0.55)', paddingHorizontal: 10, paddingVertical: 7 },
  linkPillText: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.75 },
  collectionVisual: { minHeight: 190, flexDirection: 'row', alignItems: 'center', padding: 22, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,155,61,0.5)', backgroundColor: '#F4EDDF' },
  collectionSymbol: { width: 76, height: 76, textAlign: 'center', textAlignVertical: 'center', color: GOLD, fontSize: 37, borderRadius: 22, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER, paddingTop: Platform.OS === 'web' ? 14 : 9 },
  collectionCopy: { flex: 1, minWidth: 0, marginLeft: 18 },
  collectionTitle: { color: NAVY, fontSize: 18, fontWeight: '900' },
  collectionMeta: { marginTop: 7, color: GOLD, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  collectionHint: { marginTop: 13, color: 'rgba(16,38,76,0.64)', fontSize: 11, lineHeight: 16 },
  playerVisual: { minHeight: 170, flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 22, backgroundColor: NAVY },
  album: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: GOLD, backgroundColor: '#1A3768' },
  albumStar: { color: GOLD, fontSize: 30 },
  playerCopy: { flex: 1, minWidth: 0, marginLeft: 16 },
  playerKicker: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  playerTitle: { marginTop: 6, color: PAPER, fontSize: 18, fontWeight: '900' },
  playerArtist: { marginTop: 3, color: 'rgba(251,247,238,0.62)', fontSize: 11 },
  playCircle: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: GOLD },
  playIcon: { color: NAVY, fontSize: 14, fontWeight: '900' },
  themeVisual: { minHeight: 190, flexDirection: 'row', gap: 12 },
  themeCard: { flex: 1, position: 'relative', alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  themeClassic: { borderColor: GOLD, backgroundColor: NAVY },
  themeAero: { borderColor: '#A7DDF3', backgroundColor: '#DDF5FF' },
  themeStar: { color: GOLD, fontSize: 30 },
  themeClassicText: { marginTop: 12, color: PAPER, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  themeClassicSub: { marginTop: 5, color: 'rgba(251,247,238,0.54)', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  aeroSun: { position: 'absolute', top: 18, right: 18, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF3A6', shadowColor: '#F2C94C', shadowOpacity: 0.35, shadowRadius: 8, elevation: 2 },
  aeroBubble: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: 'rgba(255,255,255,0.96)', backgroundColor: 'rgba(74,184,231,0.30)' },
  aeroBubbleSmall: { position: 'absolute', top: 38, left: 22, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)', backgroundColor: 'rgba(123,214,244,0.34)' },
  aeroMeadow: { position: 'absolute', left: '-10%', right: '-10%', bottom: -24, height: 76, borderRadius: 55, backgroundColor: '#7BCB69', opacity: 0.78 },
  themeAeroText: { marginTop: 12, color: '#12628E', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  themeAeroSub: { marginTop: 5, color: '#39768C', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  profileVisual: { minHeight: 210, padding: 17, borderRadius: 22, backgroundColor: NAVY, borderWidth: 1, borderColor: GOLD },
  profileHead: { flexDirection: 'row', alignItems: 'center' },
  profileAvatar: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  profileAvatarText: { color: NAVY, fontSize: 16, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  profileName: { color: PAPER, fontSize: 15, fontWeight: '900' },
  profileHandle: { marginTop: 2, color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  profilePublicChip: { borderRadius: 99, borderWidth: 1, borderColor: GOLD, paddingHorizontal: 8, paddingVertical: 5 },
  profilePublicText: { color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  profileDivider: { height: 1, marginVertical: 12, backgroundColor: GOLD, opacity: 0.32 },
  profileSectionLabel: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  profileEntry: { marginTop: 8, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  profileEntryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileEntryKind: { color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  profileEntryDate: { color: NAVY, fontSize: 6, fontWeight: '800', opacity: 0.56 },
  profileEntryTitle: { marginTop: 5, color: NAVY, fontSize: 12, fontWeight: '900' },
  profileEntryCopy: { marginTop: 3, color: NAVY, fontSize: 9, lineHeight: 12, opacity: 0.72 },
  profilePrivacy: { marginTop: 9, color: PAPER, fontSize: 7, fontWeight: '800', textAlign: 'center', opacity: 0.58 },
  portalVisual: { minHeight: 210, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,155,61,0.45)', backgroundColor: '#F4EDDF' },
  portalHalo: { position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: GOLD, backgroundColor: 'rgba(201,155,61,0.10)' },
  portalBell: { width: 64, height: 64 },
  portalGesture: { marginTop: 8, color: NAVY, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  exampleNote: { marginTop: 20, flexDirection: 'row', padding: 14, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(201,155,61,0.42)', backgroundColor: '#F4EDDF' },
  exampleNoteMark: { width: 24, color: GOLD, fontSize: 15 },
  exampleNoteText: { flex: 1, color: 'rgba(16,38,76,0.72)', fontSize: 11, lineHeight: 17 },
  actions: { minHeight: 82, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(16,38,76,0.14)', backgroundColor: 'rgba(251,247,238,0.98)' },
  backButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 4 },
  backText: { color: NAVY, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  finishActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 },
  textFinish: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 2 },
  textFinishLabel: { color: NAVY, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, opacity: 0.62 },
  nextButton: { minWidth: 118, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: GOLD, backgroundColor: NAVY, paddingHorizontal: 18 },
  nextText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  timerVisual: { minHeight: 190, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,155,61,0.48)', backgroundColor: '#F4EDDF' },
  timerClock: { color: NAVY, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2 },
  timerMeta: { marginTop: 5, color: GOLD, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  timerRows: { marginTop: 17, gap: 8 },
  timerRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: PAPER, borderWidth: 1, borderColor: 'rgba(16,38,76,0.12)' },
  timerRowMark: { width: 27, color: GOLD, fontSize: 14, fontWeight: '900' },
  timerRowText: { flex: 1, color: NAVY, fontSize: 11, fontWeight: '800' },
  timerRowState: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  readerVisual: { minHeight: 206, padding: 16, overflow: 'hidden', borderRadius: 22, backgroundColor: NAVY, borderWidth: 1, borderColor: 'rgba(201,155,61,0.52)' },
  readerDemoTop: { flexDirection: 'row', alignItems: 'center' },
  readerDemoPoster: { width: 48, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: GOLD, backgroundColor: '#1A3768' },
  readerDemoPosterMark: { color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 0.7 },
  readerDemoCopy: { flex: 1, minWidth: 0, marginLeft: 13 },
  readerDemoKicker: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  readerDemoTitle: { marginTop: 4, color: PAPER, fontSize: 18, fontWeight: '900' },
  readerDemoMeta: { marginTop: 3, color: 'rgba(251,247,238,0.58)', fontSize: 9 },
  readerDemoQuote: { marginTop: 15, minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: PAPER, borderLeftWidth: 4, borderLeftColor: GOLD },
  readerDemoQuoteMark: { width: 22, color: GOLD, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  readerDemoQuoteText: { flex: 1, color: NAVY, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  readerDemoFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readerDemoFooterText: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  readerQuoteButton: { borderRadius: 10, borderWidth: 1, borderColor: GOLD, paddingVertical: 7, paddingHorizontal: 10 },
  readerQuoteButtonText: { color: GOLD, fontSize: 7, fontWeight: '900', textAlign: 'center', letterSpacing: 0.7 },
  entrySourceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  entrySourceBadge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: GOLD, backgroundColor: '#1A3768' },
  entrySourceBadgeText: { color: GOLD, fontSize: 9, fontWeight: '900' },
  entrySourceCopy: { flex: 1, marginLeft: 10 },
  entrySourceKicker: { color: PAPER, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  entrySourceMeta: { marginTop: 2, color: 'rgba(251,247,238,0.55)', fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  galleryVisual: { minHeight: 206, padding: 15, borderRadius: 22, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  galleryTop: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  galleryTitle: { color: NAVY, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  galleryFilter: { borderRadius: 99, borderWidth: 1, borderColor: GOLD, paddingHorizontal: 9, paddingVertical: 5 },
  galleryFilterText: { color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  galleryGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryTile: { width: '48%', height: 66, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: GOLD, justifyContent: 'space-between' },
  galleryTileDark: { backgroundColor: NAVY },
  galleryTilePaper: { backgroundColor: PAPER },
  galleryTileMark: { color: GOLD, fontSize: 19, fontWeight: '900', letterSpacing: 0.8 },
  galleryTileMeta: { color: PAPER, fontSize: 6, fontWeight: '900', letterSpacing: 0.9 },
  galleryTileMetaDark: { color: NAVY, fontSize: 6, fontWeight: '900', letterSpacing: 0.9 },
  galleryQuoteMark: { color: GOLD, fontSize: 18, lineHeight: 18, fontWeight: '900' },
  galleryQuote: { color: NAVY, fontSize: 10, lineHeight: 12, fontWeight: '800' },
  gallerySpark: { color: GOLD, fontSize: 20 },
  gallerySparkGold: { color: GOLD, fontSize: 20 },
  topicVisual: { minHeight: 190, padding: 18, borderRadius: 22, backgroundColor: NAVY },
  topicHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topicTitle: { color: PAPER, fontSize: 18, fontWeight: '900' },
  topicTotal: { color: GOLD, fontSize: 10, fontWeight: '900' },
  topicActivities: { marginTop: 16, gap: 8 },
  topicActivity: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(201,155,61,0.32)', paddingHorizontal: 11 },
  topicActivityMark: { width: 28, color: GOLD, fontSize: 14 },
  topicActivityText: { flex: 1, color: PAPER, fontSize: 11, fontWeight: '800' },
  topicActivityTime: { color: 'rgba(251,247,238,0.62)', fontSize: 9, fontWeight: '700' },
  capsuleVisual: { minHeight: 206, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 26, borderWidth: 1, borderColor: GOLD, backgroundColor: NAVY },
  capsuleSpark: { color: GOLD, fontSize: 28 },
  capsuleKicker: { marginTop: 10, color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  capsuleTitle: { marginTop: 7, color: PAPER, fontSize: 22, fontWeight: '900' },
  capsuleDate: { minWidth: 170, marginTop: 15, paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: GOLD, backgroundColor: PAPER },
  capsuleDateLabel: { color: GOLD, fontSize: 6, fontWeight: '900', letterSpacing: 1 },
  capsuleDateValue: { marginTop: 4, color: NAVY, fontSize: 14, fontWeight: '900' },
  capsuleHint: { marginTop: 10, color: PAPER, fontSize: 8, fontWeight: '700', opacity: 0.62 },
  playlistVisual: { minHeight: 190, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,155,61,0.48)', backgroundColor: '#F4EDDF' },
  playlistHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  playlistTitle: { color: NAVY, fontSize: 16, fontWeight: '900' },
  playlistMeta: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  playlistTrack: { minHeight: 39, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(16,38,76,0.14)' },
  playlistIndex: { width: 26, color: GOLD, fontSize: 9, fontWeight: '900' },
  playlistTrackText: { flex: 1, color: NAVY, fontSize: 11, fontWeight: '800' },
  playlistPlay: { color: GOLD, fontSize: 12, fontWeight: '900' },
  statsVisual: { minHeight: 190, padding: 18, borderRadius: 22, backgroundColor: NAVY },
  statsTop: { flexDirection: 'row', gap: 10 },
  statsMetric: { flex: 1, minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,155,61,0.36)', padding: 12 },
  statsMetricValue: { color: PAPER, fontSize: 22, fontWeight: '900' },
  statsMetricLabel: { marginTop: 4, color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  netRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(251,247,238,0.18)' },
  netLabel: { flex: 1, color: PAPER, fontSize: 11, fontWeight: '800' },
  netValue: { color: GOLD, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
