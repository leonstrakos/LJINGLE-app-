import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,

  TextInput,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';
import { reloadAppAsync } from 'expo';

import {
  activeAccentColor,
  activeBackgroundColor,
  colors,
  hexToHsl,
  hslToHex,
  persistAccentColor,
  persistBackgroundColor,
} from '../theme/colors';
import { exportLocalData, importLocalData, inspectLocalBackup, type BackupInspection } from '../storage/backup';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { PortableImportPanel } from '../components/PortableImportPanel';
import { getUiSoundEffectsEnabled, setUiSoundEffectsEnabled } from '../audio/uiSoundPreference';
import {
  deleteCloudSnapshot,
  forceUploadNamedCheckpoint,
  getCloudSyncState,
  listCloudSnapshots,
  restoreCloudSnapshot,
  runCloudSync,
  type CloudSnapshotMeta,
  type CloudSyncState,
} from '../services/cloudSync';
import {
  activeVisualSkinId,
  persistVisualSkin,
  visualSkins,
  type VisualSkinId,
} from '../theme/visualSkins';
import {
  activeAeroBackgroundId,
  aeroBackgrounds,
  persistAeroBackground,
  type AeroBackgroundId,
} from '../theme/aeroBackground';
// catalogueQuietModeV1
import {
  getCatalogueDisplayMode,
  persistCatalogueDisplayMode,
  type CatalogueDisplayMode,
} from '../theme/catalogueDisplayMode';
import {
  activeRadioThemeId,
  persistRadioTheme,
  radioThemes,
  type RadioThemeId,
} from '../theme/radioTheme';

import {
  getJinglePortalEnabled,
  setJinglePortalEnabled,
} from '../services/jinglePortalPreference';
import {
  getJingleBackgroundEnabled,
  setJingleBackgroundEnabled,
} from '../services/jinglePortalStylePreference';
import { FirstRunTutorial } from '../components/FirstRunTutorial';
// ljingleOnboardingPlayerV1
const MAP_STEPS = 28;
const HUE_STEPS = 48;

// sparkleChromePresetR1
// Palette sampled from the water-sparkle reference.
const SPARKLE_CHROME_BACKGROUND = '#0A2752';
const SPARKLE_CHROME_ACCENT = '#F2F8FC';

// forkN4CelestialDefaultPaletteV12
// forkLCelestialThemeBindingV1
const DEFAULT_ACCENT = '#E8B42B';
const DEFAULT_BACKGROUND = '#010711';
// ljingleMorningFixesV1:palettePreset
// ljingleMidnightDefaultColorsR1: Settings Midnight preset
const AERO_MIDNIGHT_ACCENT = '#E8B42B';
const AERO_MIDNIGHT_BACKGROUND = '#020c57';
const mapRows = Array.from({ length: MAP_STEPS }, (_, index) => index);
const mapColumns = Array.from({ length: MAP_STEPS }, (_, index) => index);
const hueStops = Array.from({ length: HUE_STEPS }, (_, index) => index);

// phoneCanonicalCloudResetV1

// namedPhoneCanonicalUpgradeV2

const TECHNICAL_CHECKPOINT_REASONS = new Set([
  'APP_OPEN',
  'BACKGROUND',
  'PERIODIC',
  'MANUAL',
  'MANUAL_FORCE',
]);

function checkpointDisplayName(snapshot: CloudSnapshotMeta) {
  const reason = snapshot.reason?.trim();

  if (!reason || TECHNICAL_CHECKPOINT_REASONS.has(reason)) {
    return `Revision ${snapshot.revision}`;
  }

  return reason
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type CloudSyncNotice = {
  tone: 'SUCCESS' | 'CONFLICT' | 'INFO' | 'ERROR';
  eyebrow: string;
  title: string;
  copy: string;
  allowPhoneCanonical?: boolean;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

type AccentToggleProps = {
  label: string;
  value: boolean;
  disabled?: boolean;
  accent: string;
  onChange: (value: boolean) => void;
};

function AccentToggle({
  label,
  value,
  disabled = false,
  accent,
  onChange,
}: AccentToggleProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onStartShouldSetResponder={() => !disabled}
      onResponderRelease={() => {
        if (!disabled) onChange(!value);
      }}
      style={[
        styles.accentToggle,
        value && { backgroundColor: accent, borderColor: accent },
        disabled && styles.accentToggleDisabled,
      ]}
    >
      <View
        style={[
          styles.accentToggleThumb,
          value && styles.accentToggleThumbOn,
        ]}
      />
    </View>
  );
}type SettingsGroupId =
  | 'appearance'
  | 'radio'
  | 'jingle'
  | 'colors'
  | 'data';

type SettingsAccordionProps = {
  glyph: string;
  title: string;
  subtitle: string;
  open: boolean;
  onPress: () => void;
  children: any;
};

// finalSettingsDropdownsAstV18
// Five visual Settings drawers. Existing control bodies are preserved verbatim.
function SettingsAccordion({
  glyph,
  title,
  subtitle,
  open,
  onPress,
  children,
}: SettingsAccordionProps) {
  const celestialSettings =
    activeVisualSkinId === 'classic';

  return (
    <View
      style={[
        styles.settingsAccordion,
        celestialSettings &&
          styles.settingsAccordionCelestial,
        open &&
          styles.settingsAccordionOpen,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          expanded: open,
        }}
        accessibilityLabel={
          (open ? 'Zatvori ' : 'Otvori ') +
          title
        }
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingsAccordionHeader,
          open &&
            styles.settingsAccordionHeaderOpen,
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.settingsAccordionGlyph,
            open &&
              styles.settingsAccordionGlyphOpen,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={
              styles.settingsAccordionGlyphText
            }
          >
            {glyph}
          </Text>
        </View>

        <View
          style={
            styles.settingsAccordionCopy
          }
        >
          <Text
            style={
              styles.settingsAccordionTitle
            }
          >
            {title}
          </Text>
          <Text
            style={
              styles.settingsAccordionSubtitle
            }
          >
            {subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.settingsAccordionChevron,
            open &&
              styles.settingsAccordionChevronOpen,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={
              styles.settingsAccordionChevronText
            }
          >
            {open ? '⌃' : '⌄'}
          </Text>
        </View>
      </Pressable>

      {open ? (
        <View
          style={
            styles.settingsAccordionBody
          }
        >
          {celestialSettings ? (
            <View
              pointerEvents="none"
              style={
                styles.settingsAccordionStarRail
              }
            >
              <View
                style={
                  styles.settingsAccordionRailLine
                }
              />
              <Text
                allowFontScaling={false}
                style={
                  styles.settingsAccordionRailStar
                }
              >
                ✦
              </Text>
              <View
                style={
                  styles.settingsAccordionRailLine
                }
              />
            </View>
          ) : null}

          {children}
        </View>
      ) : null}
    </View>
  );
}



export function ThemePickerScreen() {
  const [accent, setAccent] = useState(activeAccentColor);
  const [openSettingsGroup, setOpenSettingsGroup] =
    useState<SettingsGroupId | null>('appearance');

  const toggleSettingsGroup = (
    group: SettingsGroupId,
  ) => {
    setOpenSettingsGroup((current) =>
      current === group ? null : group,
    );
  };

  const [backgroundColor, setBackgroundColor] = useState(activeBackgroundColor);
  const [colorTarget, setColorTarget] = useState<'accent' | 'background'>('accent');
  const [visualSkin, setVisualSkin] = useState<VisualSkinId>(activeVisualSkinId);
  const [aeroBackground, setAeroBackground] =
    useState<AeroBackgroundId>(activeAeroBackgroundId);
  const [catalogueDisplayMode, setCatalogueDisplayMode] =
    useState<CatalogueDisplayMode>(getCatalogueDisplayMode());
  const [radioTheme, setRadioTheme] = useState<RadioThemeId>(activeRadioThemeId);
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true);
  const [soundPreferenceReady, setSoundPreferenceReady] = useState(false);
  const [jinglePortalEnabled, setJinglePortalEnabledState] = useState(true);
  const [jinglePreferenceReady, setJinglePreferenceReady] = useState(false);
  const [jingleBackgroundEnabled, setJingleBackgroundEnabledState] =
    useState(false);
  const [jingleBackgroundReady, setJingleBackgroundReady] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  // themeRestartPromptV1
  const [restartPromptVisible, setRestartPromptVisible] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState('');
  // settingsJsonDownloadV2
  const [lastExportName, setLastExportName] = useState('');
  // settingsJsonImportV1
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [selectedBackupJson, setSelectedBackupJson] = useState('');
  const [selectedBackupName, setSelectedBackupName] = useState('');
  const [backupInspection, setBackupInspection] = useState<BackupInspection | null>(null);

  // cloudSyncSettingsV1
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudState, setCloudState] =
    useState<CloudSyncState | null>(null);

  const [cloudHistoryBusy, setCloudHistoryBusy] =
    useState(false);

  const [cloudSnapshots, setCloudSnapshots] =
    useState<CloudSnapshotMeta[]>([]);

  const [cloudHistoryExpanded, setCloudHistoryExpanded] =
    useState(false);

  const [cloudNotice, setCloudNotice] =
    useState<CloudSyncNotice | null>(null);

  const [checkpointName, setCheckpointName] =
    useState('');

  const refreshCloudHistory = async () => {
    setCloudHistoryBusy(true);

    try {
      const snapshots =
        await listCloudSnapshots(12);

      setCloudSnapshots(snapshots);
    } finally {
      setCloudHistoryBusy(false);
    }
  };

  useEffect(() => {
    let active = true;

    void getUiSoundEffectsEnabled()
      .then((value) => {
        if (active) setSoundEffectsEnabledState(value);
      })
      .finally(() => {
        if (active) setSoundPreferenceReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void getJinglePortalEnabled()
      .then((value) => {
        if (active) setJinglePortalEnabledState(value);
      })
      .finally(() => {
        if (active) setJinglePreferenceReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const changeSoundEffects = async (value: boolean) => {
    const previous = soundEffectsEnabled;
    setSoundEffectsEnabledState(value);

    try {
      await setUiSoundEffectsEnabled(value);
    } catch {
      setSoundEffectsEnabledState(previous);
      Alert.alert('Postavka nije spremljena', 'Pokušaj ponovno.');
    }
  };

  useEffect(() => {
    let active = true;

    void getJingleBackgroundEnabled()
      .then((enabled) => {
        if (active) setJingleBackgroundEnabledState(enabled);
      })
      .finally(() => {
        if (active) setJingleBackgroundReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const changeJinglePortal = async (value: boolean) => {
    const previous = jinglePortalEnabled;
    setJinglePortalEnabledState(value);

    try {
      await setJinglePortalEnabled(value);
    } catch {
      setJinglePortalEnabledState(previous);
      Alert.alert('Postavka nije spremljena', 'Pokušaj ponovno.');
    }
  };

  const changeJingleBackground = async (value: boolean) => {
    const previous = jingleBackgroundEnabled;
    setJingleBackgroundEnabledState(value);

    try {
      await setJingleBackgroundEnabled(value);
    } catch {
      setJingleBackgroundEnabledState(previous);
      Alert.alert('Postavka nije spremljena', 'Pokušaj ponovno.');
    }
  };

  useEffect(() => {
    void getCloudSyncState()
      .then(setCloudState)
      .catch(() => {});

    void refreshCloudHistory()
      .catch(() => {});
  }, []);
  const [mapSize, setMapSize] = useState(0);
  const [hueWidth, setHueWidth] = useState(0);
  const editingColor = colorTarget === 'accent' ? accent : backgroundColor;
  const hsl = useMemo(() => hexToHsl(editingColor), [editingColor]);

  const setEditingColor = (value: string) => {
    if (colorTarget === 'accent') setAccent(value);
    else setBackgroundColor(value);
  };

  const selectMapColor = (event: GestureResponderEvent) => {
    if (mapSize <= 0) return;
    const saturation = clamp(event.nativeEvent.locationX / mapSize) * 100;
    const lightness = (1 - clamp(event.nativeEvent.locationY / mapSize)) * 100;
    setEditingColor(hslToHex(hsl.hue, saturation, lightness));
  };

  const selectHue = (event: GestureResponderEvent) => {
    if (hueWidth <= 0) return;
    const hue = clamp(event.nativeEvent.locationX / hueWidth) * 360;
    setEditingColor(hslToHex(hue, hsl.saturation, hsl.lightness));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setRestartError('');
    try {
      persistAccentColor(accent);
      persistBackgroundColor(backgroundColor);
      persistVisualSkin(visualSkin);
      persistAeroBackground(aeroBackground);
      persistCatalogueDisplayMode(catalogueDisplayMode);
      persistRadioTheme(radioTheme);

      // Theme tokens are module-level values, so reload the JS runtime after
      // confirmation. Reset saving first so backup controls never remain grey.
      setSaving(false);
      setRestartPromptVisible(true);
    } catch {
      setSaving(false);
      Alert.alert('Boja nije spremljena', 'Pokušajte ponovno. Vaši podaci nisu promijenjeni.');
    }
  };

  const restartAfterThemeSave = async () => {
    if (restarting) return;
    setRestarting(true);
    setRestartError('');

    try {
      await reloadAppAsync('theme-settings-changed');
    } catch {
      setRestarting(false);
      setRestartError(
        'Automatsko ponovno pokretanje nije uspjelo. Zatvori i ponovno otvori aplikaciju.',
      );
    }
  };

  const syncNow = async () => {
    if (cloudBusy) return;

    setCloudBusy(true);

    try {
      const result = await runCloudSync({
        reason: 'MANUAL',
      });

      setCloudState(result.state);
      await refreshCloudHistory();

      const notices: Record<string, CloudSyncNotice> = {
        uploaded: {
          tone: 'SUCCESS',
          eyebrow: 'CLOUD UPDATED',
          title: 'Sinkronizirano',
          copy: 'Trenutni podaci s ovog uređaja spremljeni su u cloud.',
        },
        synced: {
          tone: 'SUCCESS',
          eyebrow: 'ALL CLEAR',
          title: 'Sve je usklađeno',
          copy: 'Lokalna baza i cloud checkpoint imaju isti sadržaj.',
        },
        offline: {
          tone: 'ERROR',
          eyebrow: 'NO CONNECTION',
          title: 'Cloud nije dostupan',
          copy: 'Nema internetske veze. Lokalni katalog ostaje potpuno siguran.',
        },
        'wifi-only': {
          tone: 'INFO',
          eyebrow: 'WI-FI ONLY',
          title: 'Sync je pauziran',
          copy: 'Cloud Sync je trenutno dopušten samo preko Wi-Fi veze.',
        },
        'cloud-newer': {
          tone: 'CONFLICT',
          eyebrow: 'CLOUD IS DIFFERENT',
          title: 'Cloud ima drugu verziju',
          copy: 'Ništa nije prepisano. Ako su podaci na ovom mobitelu oni koje želiš zadržati, možeš ih postaviti kao jedinu glavnu cloud verziju.',
          allowPhoneCanonical: true,
        },
        conflict: {
          tone: 'CONFLICT',
          eyebrow: 'TWO VERSIONS',
          title: 'Lokalna i cloud verzija se razlikuju',
          copy: 'LJingle je namjerno zaustavio sync prije overwritea. Možeš zadržati ovaj mobitel kao glavnu verziju i očistiti stare cloud checkpointove.',
          allowPhoneCanonical: true,
        },
        disabled: {
          tone: 'INFO',
          eyebrow: 'SYNC OFF',
          title: 'Cloud Sync je isključen',
          copy: 'Lokalni katalog nije promijenjen.',
        },
        error: {
          tone: 'ERROR',
          eyebrow: 'SYNC ERROR',
          title: 'Cloud Sync nije uspio',
          copy:
            result.state.lastError ||
            'Lokalni podaci nisu promijenjeni.',
        },
      };

      setCloudNotice(
        notices[result.outcome] ?? {
          tone: 'INFO',
          eyebrow: 'CLOUD STATUS',
          title: 'Cloud Sync',
          copy: `Status: ${result.outcome}`,
        },
      );
    } catch (caught) {
      setCloudNotice({
        tone: 'ERROR',
        eyebrow: 'SYNC ERROR',
        title: 'Cloud Sync nije uspio',
        copy:
          caught instanceof Error
            ? caught.message
            : 'Lokalni podaci nisu promijenjeni.',
      });
    } finally {
      setCloudBusy(false);
    }
  };

  const makeThisPhoneCanonical = async () => {
    if (cloudBusy || cloudHistoryBusy) return;

    const cleanName = checkpointName
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 32);

    if (!cleanName) {
      setCloudNotice({
        tone: 'CONFLICT',
        eyebrow: 'NAME THIS CHECKPOINT',
        title: 'Dodaj naziv prije spremanja',
        copy: 'Naziv poput “Post search repair” ili “Clean phone 26 Aug” olakšat će ti kasnije prepoznati ovu verziju.',
        allowPhoneCanonical: true,
      });
      return;
    }

    setCloudBusy(true);
    setCloudHistoryBusy(true);

    setCloudNotice({
      tone: 'INFO',
      eyebrow: 'MAKING CHECKPOINT',
      title: 'Spremam ovaj mobitel…',
      copy: `Prvo šaljem “${cleanName}”. Stare cloud revizije brišu se tek nakon potvrđenog uploada.`,
    });

    try {
      const pushed = await forceUploadNamedCheckpoint(cleanName);
      const canonicalRevision = pushed.manifest?.revision ?? pushed.state.lastRevision;

      if (pushed.outcome !== 'uploaded' && pushed.outcome !== 'synced') {
        throw new Error(pushed.state.lastError || 'Cloud nije potvrdio novi checkpoint.');
      }

      if (canonicalRevision == null || !Number.isInteger(canonicalRevision)) {
        throw new Error('Cloud nije vratio valjani canonical revision.');
      }

      // Safety order: new phone checkpoint EXISTS before anything old is deleted.
      const snapshots = await listCloudSnapshots(100);

      for (const snapshot of snapshots) {
        if (snapshot.revision === canonicalRevision) continue;
        await deleteCloudSnapshot(snapshot.revision);
      }

      setCloudState(pushed.state);
      await refreshCloudHistory();
      setCheckpointName('');

      setCloudNotice({
        tone: 'SUCCESS',
        eyebrow: 'PHONE IS CANONICAL',
        title: cleanName,
        copy: `Revision ${canonicalRevision} sada je jedini cloud checkpoint. Sadrži trenutne podatke s ovog mobitela i postavljen je kao nova sync baza.`,
      });
    } catch (caught) {
      setCloudNotice({
        tone: 'ERROR',
        eyebrow: 'RESET STOPPED',
        title: 'Canonical save nije dovršen',
        copy: caught instanceof Error
          ? caught.message
          : 'Lokalni podaci na mobitelu nisu promijenjeni.',
        allowPhoneCanonical: true,
      });
    } finally {
      setCloudHistoryBusy(false);
      setCloudBusy(false);
    }
  };

  const restoreCloudRevision = (revision: number) => {
    Alert.alert(
      'Vrati cloud checkpoint?',
      `Revision ${revision} zamijenit će lokalne podatke. Prije toga se radi lokalni safety backup.`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => void (async () => {
            setCloudHistoryBusy(true);
            try {
              const result =
                await restoreCloudSnapshot(revision);

              setCloudState(result.state);
              await refreshCloudHistory();

              Alert.alert(
                'Cloud restore gotov',
                `Revision ${revision} je vraćen.`,
              );
            } catch (caught) {
              Alert.alert(
                'Restore nije uspio',
                caught instanceof Error
                  ? caught.message
                  : 'Lokalni podaci nisu promijenjeni.',
              );
            } finally {
              setCloudHistoryBusy(false);
            }
          })(),
        },
      ],
    );
  };

  const deleteCloudRevision = (revision: number) => {
    Alert.alert(
      'Obriši cloud checkpoint?',
      `Revision ${revision} bit će trajno obrisan iz clouda. Lokalni SQLite se ne dira.`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void (async () => {
            try {
              await deleteCloudSnapshot(revision);
              await refreshCloudHistory();
            } catch (caught) {
              Alert.alert(
                'Brisanje nije uspjelo',
                caught instanceof Error
                  ? caught.message
                  : 'Checkpoint nije obrisan.',
              );
            }
          })(),
        },
      ],
    );
  };

  const exportData = async () => {
    if (saving || restoreBusy) return;

    setSaving(true);
    try {
      const text = await exportLocalData();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ljingle-backup-${stamp}.json`;

      if (Platform.OS === 'web') {
        // settingsJsonDownloadV2 — do NOT render this large string in React.
        const web = globalThis as unknown as {
          Blob?: new (parts: unknown[], options?: { type?: string }) => unknown;
          URL?: {
            createObjectURL: (value: unknown) => string;
            revokeObjectURL: (value: string) => void;
          };
          document?: {
            body?: { appendChild: (node: unknown) => void };
            createElement: (tag: string) => {
              href: string;
              download: string;
              click: () => void;
              remove: () => void;
            };
          };
        };

        if (!web.Blob || !web.URL || !web.document) {
          throw new Error('Browser ne podržava sigurno preuzimanje backupa.');
        }

        const blob = new web.Blob([text], { type: 'application/json;charset=utf-8' });
        const href = web.URL.createObjectURL(blob);
        const anchor = web.document.createElement('a');
        anchor.href = href;
        anchor.download = filename;
        web.document.body?.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => web.URL?.revokeObjectURL(href), 0);
      } else {
        const file = new File(Paths.document, filename);
        file.create({ overwrite: true, intermediates: true });
        file.write(text);
      }

      setLastExportName(filename);
    } catch (caught) {
      Alert.alert(
        'Izvoz nije uspio',
        caught instanceof Error ? caught.message : 'Podaci nisu promijenjeni. Pokušaj ponovno.',
      );
    } finally {
      setSaving(false);
    }
  };

  const chooseBackupFile = async () => {
    if (saving || restoreBusy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const text = await new File(asset.uri).text();
      const inspection = inspectLocalBackup(text);

      setSelectedBackupJson(text);
      setSelectedBackupName(asset.name || 'backup.json');
      setBackupInspection(inspection);
    } catch (caught) {
      setSelectedBackupJson('');
      setSelectedBackupName('');
      setBackupInspection(null);
      Alert.alert(
        'JSON nije učitan',
        caught instanceof Error ? caught.message : 'Odabrani backup nije valjan.',
      );
    }
  };

  const restoreSelectedBackup = () => {
    if (!selectedBackupJson || !backupInspection || restoreBusy || saving) return;

    const when = backupInspection.exportedAt
      ? new Date(backupInspection.exportedAt).toLocaleString('hr-HR')
      : 'nepoznat datum';

    Alert.alert(
      'Vrati JSON backup?',
      `Ovo će zamijeniti lokalne podatke iz ${backupInspection.tableCount} tablica backupom od ${when}.`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Vrati backup',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRestoreBusy(true);
              try {
                await importLocalData(selectedBackupJson);
                setSelectedBackupJson('');
                setSelectedBackupName('');
                setBackupInspection(null);
                Alert.alert(
                  'Backup je vraćen',
                  'Restartaj aplikaciju kako bi svi ekrani ponovno učitali obnovljene podatke.',
                );
              } catch (caught) {
                Alert.alert(
                  'Backup nije vraćen',
                  caught instanceof Error ? caught.message : 'Podaci nisu promijenjeni.',
                );
              } finally {
                setRestoreBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}></Text>
          <Text style={styles.heading}>Postavke</Text>
          <Text style={styles.intro}>
            Odaberi jednu boju. Aplikacija sama iz nje radi pozadine, obrube i gumbe.
          </Text>
        </View>

        
        <SettingsAccordion
          glyph="✦"
          title="Izgled"
          subtitle="Vizualni svijet i Aero / Meadow pozadina"
          open={openSettingsGroup === 'appearance'}
          onPress={() =>
            toggleSettingsGroup('appearance')
          }
        >
<View style={styles.section}>
          <Text style={styles.sectionLabel}>Vizualni svijet</Text>
          <Text style={styles.sectionHint}>Odvojeno od boje aplikacije</Text>
          <View style={styles.skinGrid}>
            {visualSkins.map((skin) => {
              const selected = visualSkin === skin.id;
              return (
                <Pressable
                  key={skin.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setVisualSkin(skin.id)}
                  style={({ pressed }) => [
                    styles.skinCard,
                    skin.id === 'aero' && styles.skinCardAero,
                    selected && styles.skinCardSelected,
                    selected && skin.id === 'aero' && styles.skinCardAeroSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.skinTopRow}>
                    <Text style={[styles.skinCode, skin.id === 'aero' && styles.skinAeroCode, selected && styles.skinCodeSelected, selected && skin.id === 'aero' && styles.skinAeroCodeSelected]}>{skin.shortName}</Text>
                    <View style={[styles.skinRadio, skin.id === 'aero' && styles.skinAeroRadio, selected && styles.skinRadioSelected, selected && skin.id === 'aero' && styles.skinAeroRadioSelected]} />
                  </View>
                  {skin.id === 'aero' ? (
                    <View pointerEvents="none" style={styles.skinAeroPreview}>
                      <View style={styles.skinAeroSun} />
                      <View style={styles.skinAeroBubbleOne} />
                      <View style={styles.skinAeroBubbleTwo} />
                      <View style={styles.skinAeroHillBack} />
                      <View style={styles.skinAeroHillFront} />
                      <Text style={styles.skinAeroPreviewText}>AERO MAX</Text>
                    </View>
                  ) : (
                    <Text style={styles.skinSpecimen}>{skin.specimen}</Text>
                  )}
                  <Text style={[styles.skinName, skin.id === 'aero' && styles.skinAeroName]}>{skin.name}</Text>
                  <Text style={[styles.skinDescription, skin.id === 'aero' && styles.skinAeroDescription]}>{skin.description}</Text>
                  <Text style={[styles.skinStatus, skin.id === 'aero' && styles.skinAeroStatus]}>
                    {skin.id === 'classic' ? 'AKTIVAN DIZAJN' : skin.id === 'aero' ? 'OCEAN · MEADOW · GLASS' : 'TEMELJ SPREMAN'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* aeroBackgroundPickerV2 */}
        {visualSkin === 'aero' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Aero pozadina
            </Text>

            <Text style={styles.sectionHint}>
              Meadow je mirniji Vista stil. Ocean zadr?ava puni Frutiger.
            </Text>

            <View style={styles.aeroBackgroundGrid}>
              {aeroBackgrounds.map((preset) => {
                const selected =
                  aeroBackground === preset.id;

                return (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selected,
                    }}
                    onPress={() =>
                      setAeroBackground(preset.id)
                    }
                    style={({ pressed }) => [
                      styles.aeroBackgroundCard,
                      selected &&
                        styles.aeroBackgroundCardSelected,
                      selected && {
                        borderColor: accent,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Image
                      source={
                        preset.id === 'meadow'
                          ? require('../assets/aero/aero-meadow-ufo.jpeg')
                          : require('../assets/aero/aero-world-bg2.webp')
                      }
                      resizeMode="cover"
                      style={styles.aeroBackgroundPreview}
                    />

                    <View style={styles.aeroBackgroundCopy}>
                      <View
                        style={
                          styles.aeroBackgroundTitleRow
                        }
                      >
                        <Text
                          style={
                            styles.aeroBackgroundName
                          }
                        >
                          {preset.name}
                        </Text>

                        <View
                          style={[
                            styles.skinRadio,
                            selected &&
                              styles.skinRadioSelected,
                            selected && {
                              borderColor: accent,
                            },
                          ]}
                        />
                      </View>

                      <Text
                        style={
                          styles.aeroBackgroundDescription
                        }
                      >
                        {preset.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        
        </SettingsAccordion>

        <SettingsAccordion
          glyph="⌁"
          title="Radio i katalog"
          subtitle="Memory Radio izgled i gustoća kataloga"
          open={openSettingsGroup === 'radio'}
          onPress={() =>
            toggleSettingsGroup('radio')
          }
        >
<View style={[styles.section, styles.radioThemeSection]}>
          <Text style={styles.sectionLabel}>Izgled Memory Radija</Text>
          <Text style={styles.sectionHint}>
            Neovisno o glavnom vizualnom svijetu
          </Text>

          <View style={styles.radioThemeGrid}>
            {radioThemes.map((preset) => {
              const selected = radioTheme === preset.id;
              const inverted = preset.id === 'inverted';

              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setRadioTheme(preset.id)}
                  style={({ pressed }) => [
                    styles.radioThemeCard,
                    selected && styles.radioThemeCardSelected,
                    selected && { borderColor: accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.radioPreviewBody,
                      {
                        backgroundColor: inverted ? '#FFFFFF' : accent,
                        borderColor: accent,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radioPreviewDisplay,
                        {
                          backgroundColor: inverted ? accent : '#FFFFFF',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radioPreviewLine,
                          {
                            backgroundColor: inverted
                              ? '#FFFFFF'
                              : accent,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.radioPreviewLineShort,
                          {
                            backgroundColor: inverted
                              ? '#FFFFFF'
                              : accent,
                          },
                        ]}
                      />
                    </View>

                    <View
                      style={[
                        styles.radioPreviewKnob,
                        {
                          backgroundColor: inverted ? accent : '#FFFFFF',
                          borderColor: inverted ? accent : '#1D1D1F',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radioPreviewKnobMark,
                          {
                            backgroundColor: inverted
                              ? '#FFFFFF'
                              : accent,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.radioThemeCopy}>
                    <View style={styles.radioThemeNameRow}>
                      <Text style={styles.radioThemeName}>
                        {preset.name}
                      </Text>
                      <View
                        style={[
                          styles.skinRadio,
                          selected && styles.skinRadioSelected,
                          selected && { borderColor: accent },
                        ]}
                      />
                    </View>

                    <Text style={styles.radioThemeDescription}>
                      {preset.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.displaySection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionLabel}>Prikaz kataloga</Text>
              <Text style={styles.sectionHint}>Koliko vizualnog sadržaja želiš u listama</Text>
            </View>
            <Text style={styles.displayModeCode}>
              {catalogueDisplayMode === 'compact' ? 'MIRNO' : 'BOGATO'}
            </Text>
          </View>

          <View style={styles.displayModeGrid}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: catalogueDisplayMode === 'rich' }}
              onPress={() => setCatalogueDisplayMode('rich')}
              style={({ pressed }) => [
                styles.displayModeCard,
                catalogueDisplayMode === 'rich' && styles.displayModeCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.displayModeTop}>
                <Text style={styles.displayModeTitle}>Bogati prikaz</Text>
                <View
                  style={[
                    styles.skinRadio,
                    catalogueDisplayMode === 'rich' && styles.skinRadioSelected,
                  ]}
                />
              </View>
              <Text style={styles.displayModeCopy}>
                Naslovnice i posteri ostaju u listama, uz puni pregled napretka.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: catalogueDisplayMode === 'compact' }}
              onPress={() => setCatalogueDisplayMode('compact')}
              style={({ pressed }) => [
                styles.displayModeCard,
                catalogueDisplayMode === 'compact' && styles.displayModeCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.displayModeTop}>
                <Text style={styles.displayModeTitle}>Mirni prikaz</Text>
                <View
                  style={[
                    styles.skinRadio,
                    catalogueDisplayMode === 'compact' && styles.skinRadioSelected,
                  ]}
                />
              </View>
              <Text style={styles.displayModeCopy}>
                Bez covera i postera u listama. Čisti tileovi, manje buke i više sadržaja na ekranu.
              </Text>
              <Text style={styles.displayModeNote}>
                Detaljni ekran i dalje može prikazati sliku.
              </Text>
            </Pressable>
          </View>
        </View>

        
        </SettingsAccordion>

        <SettingsAccordion
          glyph="✧"
          title="Jingle i zvuk"
          subtitle="Zvono, podloga, sound effects i feedback"
          open={openSettingsGroup === 'jingle'}
          onPress={() =>
            toggleSettingsGroup('jingle')
          }
        >
<View style={styles.section}>
          <View style={styles.soundSettingRow}>
            <View style={styles.soundSettingCopy}>
              <Text style={styles.sectionLabel}>Sound effects</Text>
              <Text style={styles.soundSettingHint}>
                Zvuk pri otvaranju appa, stvaranju, brisanju i Jingleu. Haptics i motion ostaju aktivni.
              </Text>
            </View>
            <AccentToggle
              label="Sound effects"
              disabled={!soundPreferenceReady}
              accent={accent}
              onChange={(value) => void changeSoundEffects(value)}
              value={soundEffectsEnabled}
            />
          </View>
        </View>

                <View style={styles.section}>
          <View style={styles.soundSettingRow}>
            <View style={styles.soundSettingCopy}>
              <Text style={styles.sectionLabel}>Jingle button</Text>
              <Text style={styles.soundSettingHint}>
                Prikaži plutajuće Jingle zvono. Kad je isključeno, Command Palette i gesture prečaci i dalje rade.
              </Text>
            </View>
            <AccentToggle
              label="Jingle button"
              disabled={!jinglePreferenceReady}
              accent={accent}
              onChange={(value) => void changeJinglePortal(value)}
              value={jinglePortalEnabled}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.soundSettingRow}>
            <View style={styles.soundSettingCopy}>
              <Text style={styles.sectionLabel}>Jingle background</Text>
              <Text style={styles.soundSettingHint}>
                Podloga iza plutajućeg zvona. Isključi za čisto lebdeće zvono bez plavog ili glass kruga.
              </Text>
            </View>
            <AccentToggle
              label="Jingle background"
              disabled={!jingleBackgroundReady}
              accent={accent}
              onChange={(value) => void changeJingleBackground(value)}
              value={jingleBackgroundEnabled}
            />
          </View>
        </View>


        </SettingsAccordion>

        <SettingsAccordion
          glyph="◉"
          title="Boje"
          subtitle="Accent, pozadina i pregled palete"
          open={openSettingsGroup === 'colors'}
          onPress={() =>
            toggleSettingsGroup('colors')
          }
        >
<View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionLabel}>
                {colorTarget === 'accent' ? 'Boja naglaska' : 'Boja pozadine'}
              </Text>
              <Text style={styles.sectionHint}>Klikni ili povuci po mapi</Text>
            </View>
            <View style={[styles.colorChip, { backgroundColor: editingColor }]}>
              <Text style={styles.colorChipText}>{editingColor}</Text>
            </View>
          </View>

          <View style={styles.colorTargetRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setColorTarget('accent')}
              style={[
                styles.colorTargetButton,
                colorTarget === 'accent' && styles.colorTargetButtonSelected,
                colorTarget === 'accent' && { borderColor: accent },
              ]}
            >
              <View style={[styles.colorTargetDot, { backgroundColor: accent }]} />
              <Text
                style={[
                  styles.colorTargetText,
                  colorTarget === 'accent' && styles.colorTargetTextSelected,
                ]}
              >
                Accent
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setColorTarget('background')}
              style={[
                styles.colorTargetButton,
                colorTarget === 'background' && styles.colorTargetButtonSelected,
                colorTarget === 'background' && { borderColor: accent },
              ]}
            >
              <View
                style={[
                  styles.colorTargetDot,
                  { backgroundColor: backgroundColor },
                ]}
              />
              <Text
                style={[
                  styles.colorTargetText,
                  colorTarget === 'background' && styles.colorTargetTextSelected,
                ]}
              >
                Pozadina
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Primijeni midnight paletu"
            onPress={() => {
              setAccent(AERO_MIDNIGHT_ACCENT);
              setBackgroundColor(AERO_MIDNIGHT_BACKGROUND);
            }}
            style={({ pressed }) => [
              styles.originalBackgroundButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.dualPresetSwatches}>
              <View style={[styles.dualPresetSwatch, { backgroundColor: AERO_MIDNIGHT_BACKGROUND }]} />
              <View style={[styles.dualPresetSwatch, { backgroundColor: AERO_MIDNIGHT_ACCENT }]} />
            </View>
            <View style={styles.originalBackgroundCopy}>
              <Text style={styles.originalBackgroundTitle}>Midnight</Text>
              <Text style={styles.originalBackgroundValue}>
                {AERO_MIDNIGHT_BACKGROUND} · {AERO_MIDNIGHT_ACCENT}
              </Text>
            </View>
          </Pressable>
          {/* ljingleSparkleChromeColorSchemeR1 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Primijeni Sparkle Chrome paletu"
            onPress={() => {
              setAccent(
                SPARKLE_CHROME_ACCENT
              );
              setBackgroundColor(
                SPARKLE_CHROME_BACKGROUND
              );
            }}
            style={({ pressed }) => [
              styles.originalBackgroundButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.dualPresetSwatches}>
              <View
                style={[
                  styles.dualPresetSwatch,
                  {
                    backgroundColor:
                      SPARKLE_CHROME_BACKGROUND,
                  },
                ]}
              />
              <View
                style={[
                  styles.dualPresetSwatch,
                  {
                    backgroundColor:
                      SPARKLE_CHROME_ACCENT,
                  },
                ]}
              />
            </View>
          
            <View style={styles.originalBackgroundCopy}>
              <Text style={styles.originalBackgroundTitle}>
                Sparkle Chrome
              </Text>
              <Text style={styles.originalBackgroundValue}>
                {SPARKLE_CHROME_BACKGROUND} · {SPARKLE_CHROME_ACCENT}
              </Text>
            </View>
          </Pressable>


          {colorTarget === 'accent' ? (
            <Pressable
              // finalHomeProfileJinglePolishV1
              accessibilityRole="button"
              accessibilityLabel="Vrati izvorni Jingle accent"
              onPress={() => setAccent(DEFAULT_ACCENT)}
              style={({ pressed }) => [
                styles.originalBackgroundButton,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.originalBackgroundSwatch,
                  { backgroundColor: DEFAULT_ACCENT },
                ]}
              />
              <View style={styles.originalBackgroundCopy}>
                <Text style={styles.originalBackgroundTitle}>
                  Vrati izvorni Jingle accent
                </Text>
                <Text style={styles.originalBackgroundValue}>
                  {DEFAULT_ACCENT} · Jingle
                </Text>
              </View>
            </Pressable>
          ) : null}

          {colorTarget === 'background' ? (
            <Pressable
              // originalBackgroundResetV1
              accessibilityRole="button"
              accessibilityLabel="Vrati originalnu pozadinu"
              onPress={() => setBackgroundColor(DEFAULT_BACKGROUND)}
              style={({ pressed }) => [
                styles.originalBackgroundButton,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.originalBackgroundSwatch,
                  { backgroundColor: DEFAULT_BACKGROUND },
                ]}
              />
              <View style={styles.originalBackgroundCopy}>
                <Text style={styles.originalBackgroundTitle}>
                  Vrati originalnu pozadinu
                </Text>
                <Text style={styles.originalBackgroundValue}>
                  {DEFAULT_BACKGROUND} · LJingle
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View
            accessibilityLabel="Mapa boje"
            accessibilityRole="adjustable"
            onLayout={(event) => setMapSize(event.nativeEvent.layout.width)}
            onResponderGrant={selectMapColor}
            onResponderMove={selectMapColor}
            onStartShouldSetResponder={() => true}
            style={styles.colorMap}
          >
            <View pointerEvents="none" style={styles.mapPixels}>
              {mapRows.map((row) => (
                <View key={row} style={styles.mapRow}>
                  {mapColumns.map((column) => (
                    <View
                      key={column}
                      style={[
                        styles.mapPixel,
                        {
                          backgroundColor: hslToHex(
                            hsl.hue,
                            (column / (MAP_STEPS - 1)) * 100,
                            (1 - row / (MAP_STEPS - 1)) * 100,
                          ),
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.mapCursor,
                {
                  left: `${hsl.saturation}%`,
                  top: `${100 - hsl.lightness}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.hueLabel}>Nijansa</Text>
          <View
            accessibilityLabel="Odaberi nijansu"
            accessibilityRole="adjustable"
            onLayout={(event) => setHueWidth(event.nativeEvent.layout.width)}
            onResponderGrant={selectHue}
            onResponderMove={selectHue}
            onStartShouldSetResponder={() => true}
            style={styles.hueStrip}
          >
            <View pointerEvents="none" style={styles.huePixels}>
              {hueStops.map((stop) => (
                <View
                  key={stop}
                  style={[
                    styles.huePixel,
                    { backgroundColor: hslToHex((stop / (HUE_STEPS - 1)) * 360, 88, 50) },
                  ]}
                />
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[styles.hueCursor, { left: `${(hsl.hue / 360) * 100}%` }]}
            />
          </View>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewCopy}>
            <Text style={styles.previewEyebrow}>Pregled</Text>
            <Text style={styles.previewTitle}>Accent + pozadina</Text>
            <Text style={styles.previewSubtitle}>
              Accent upravlja kontrolama, a pozadina cijelom neutralnom paletom aplikacije.
            </Text>
          </View>
          <View style={[styles.previewButton, { backgroundColor: accent }]}>
            <Text style={styles.previewButtonText}>Primjer</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAccent(DEFAULT_ACCENT);
              setBackgroundColor(DEFAULT_BACKGROUND);
            }}
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resetText}>Vrati zadane boje</Text>
          </Pressable>

        </View>

        
        </SettingsAccordion>

        <SettingsAccordion
          glyph="□"
          title="Podaci i sync"
          subtitle="Cloud, prijenos, backup i restore"
          open={openSettingsGroup === 'data'}
          onPress={() =>
            toggleSettingsGroup('data')
          }
        >
<View style={styles.importBox}>
          <Text style={styles.importLabel}>CLOUD SYNC</Text>

          <Text style={styles.importTitle}>
            Osobni cloud archive
          </Text>

          <Text style={styles.importCopy}>
            {cloudState?.lastSyncedAt
              ? `Last sync: ${new Date(cloudState.lastSyncedAt).toLocaleString('hr-HR')}`
              : 'Još nije sinkronizirano.'}
          </Text>

          <Text style={styles.importMeta}>
            Cloud revision: {cloudSnapshots[0]?.revision ?? '—'}
          </Text>

          <Pressable
            disabled={cloudBusy}
            onPress={() => void syncNow()}
            style={styles.importButton}
          >
            <Text style={styles.importButtonText}>
              {cloudBusy ? 'Syncing…' : 'Sync now'}
            </Text>
          </Pressable>

          <View style={styles.cloudHistoryHeader}>
            <View style={styles.cloudHistoryHeaderCopy}>
              <Text style={styles.importLabel}>
                CLOUD HISTORY
              </Text>

              <Text style={styles.cloudHistorySummary}>
                {cloudSnapshots.length > 0
                  ? `${cloudSnapshots.length} retained checkpoints`
                  : 'No checkpoints yet'}
              </Text>
            </View>

            {cloudSnapshots.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                disabled={cloudHistoryBusy}
                onPress={() =>
                  setCloudHistoryExpanded(
                    (current) => !current,
                  )
                }
                style={({ pressed }) => [
                  styles.cloudHistoryToggle,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cloudHistoryToggleText}>
                  {cloudHistoryExpanded
                    ? 'HIDE'
                    : 'OLDER'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {cloudSnapshots[0] ? (
            <View style={styles.cloudLatest}>
              <View style={styles.cloudLatestTop}>
                <View style={styles.cloudLatestCopy}>
                  <Text style={styles.cloudLatestKicker}>
                    LATEST CHECKPOINT
                  </Text>

                  <Text style={styles.cloudLatestTitle}>
                    {checkpointDisplayName(
                      cloudSnapshots[0],
                    )}
                  </Text>

                  <Text style={styles.importMeta}>
                    Revision {cloudSnapshots[0].revision}{' · '}
                    {cloudSnapshots[0].createdAt
                      ? new Date(
                          cloudSnapshots[0].createdAt,
                        ).toLocaleString('hr-HR')
                      : 'Unknown date'}
                    {' · '}
                    {(
                      cloudSnapshots[0].backupBytes /
                      1024 /
                      1024
                    ).toFixed(1)} MB
                  </Text>
                </View>

                <Pressable
                  disabled={cloudHistoryBusy}
                  onPress={() =>
                    restoreCloudRevision(
                      cloudSnapshots[0]!.revision,
                    )
                  }
                  style={({ pressed }) => [
                    styles.cloudLatestRestore,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cloudLatestRestoreText}>
                    RESTORE
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {cloudHistoryExpanded ? (
            <View style={styles.cloudOlder}>
              {cloudSnapshots
                .slice(1)
                .map((snapshot) => (
                  <View
                    key={snapshot.revision}
                    style={styles.cloudOlderRow}
                  >
                    <View style={styles.cloudOlderCopy}>
                      <Text style={styles.cloudOlderTitle}>
                        {checkpointDisplayName(
                          snapshot,
                        )}
                      </Text>

                      <Text style={styles.cloudOlderMeta}>
                        Revision {snapshot.revision}{' · '}
                        {snapshot.createdAt
                          ? new Date(
                              snapshot.createdAt,
                            ).toLocaleString('hr-HR')
                          : 'Unknown date'}
                        {' · '}
                        {(
                          snapshot.backupBytes /
                          1024 /
                          1024
                        ).toFixed(1)} MB
                      </Text>
                    </View>

                    <View style={styles.cloudOlderActions}>
                      <Pressable
                        disabled={cloudHistoryBusy}
                        onPress={() =>
                          restoreCloudRevision(
                            snapshot.revision,
                          )
                        }
                        style={({ pressed }) => [
                          styles.cloudTextAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cloudTextActionText}>
                          Restore
                        </Text>
                      </Pressable>

                      <Pressable
                        disabled={cloudHistoryBusy}
                        onPress={() =>
                          deleteCloudRevision(
                            snapshot.revision,
                          )
                        }
                        style={({ pressed }) => [
                          styles.cloudTextAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cloudDeleteText}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
            </View>
          ) : null}

        </View>
        

        

        

        

        

        


        <PortableImportPanel />

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void exportData()}
          style={({ pressed }) => [
            styles.exportButton,
            pressed && styles.pressed,
            saving && styles.exportDisabled,
          ]}
        >
          <Text style={styles.exportTitle}>


            {saving ? 'Pripremam backup…' : 'Preuzmi JSON backup'}
          </Text>
          <Text style={styles.exportCopy}>
            Sprema puni lokalni backup kao datoteku bez prikazivanja golemog JSON-a na ekranu.
          </Text>
        </Pressable>

        {lastExportName ? (
          <View style={styles.exportSuccess}>
            <Text style={styles.exportSuccessTitle}>BACKUP SPREMAN</Text>
            <Text numberOfLines={1} style={styles.exportSuccessFile}>{lastExportName}</Text>
            <Text style={styles.exportSuccessCopy}>
              {Platform.OS === 'web' ? 'Datoteka je poslana u Downloads.' : 'Datoteka je spremljena lokalno u aplikaciji.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.importBox}>
          <Text style={styles.importLabel}>JSON RESTORE</Text>
          <Text style={styles.importTitle}>Uvezi postojeći backup</Text>
          <Text style={styles.importCopy}>
            Odaberi JSON koji je izvezen iz LJinglea. Prvo ga provjeravamo; ništa se ne mijenja dok ne potvrdiš vraćanje.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={saving || restoreBusy}
            onPress={() => void chooseBackupFile()}
            style={({ pressed }) => [
              styles.importButton,
              pressed && styles.pressed,
              (saving || restoreBusy) && styles.exportDisabled,
            ]}
          >
            <Text style={styles.importButtonText}>
              {restoreBusy ? 'Vraćam backup…' : 'Odaberi JSON backup'}
            </Text>
          </Pressable>

          {backupInspection ? (
            <View style={styles.importSelected}>
              <Text numberOfLines={1} style={styles.importFilename}>{selectedBackupName}</Text>
              <Text style={styles.importMeta}>
                {backupInspection.tableCount} tablica · {backupInspection.rowCount} redaka
                {backupInspection.exportedAt
                  ? ` · ${new Date(backupInspection.exportedAt).toLocaleString('hr-HR')}`
                  : ''}
              </Text>
              {backupInspection.legacy ? (
                <Text style={styles.importWarning}>Stari V1 backup — vraćaju se samo tablice koje taj backup sadrži.</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={restoreBusy || saving}
                onPress={restoreSelectedBackup}
                style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
              >
                <Text style={styles.restoreButtonText}>Vrati ovaj backup</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.importNote}>
            Memory Radio audio datoteke nisu ugrađene u JSON; backup čuva njihove zapise i veze, ali ne i same MP3/M4A/WAV bajtove.
          </Text>
        </View>

      
        </SettingsAccordion>

        {/* ljingleTutorialStandaloneSettingsR1 */}
<Pressable
          accessibilityRole="button"
          onPress={() => setTutorialVisible(true)}
          style={({ pressed }) => [
            styles.tutorialButton,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.tutorialButtonMark}>
            <Text style={styles.tutorialButtonMarkText}>?</Text>
          </View>
          <View style={styles.tutorialButtonCopy}>
            <Text style={styles.tutorialButtonTitle}>Otvori LJingle tutorial</Text>
            <Text style={styles.tutorialButtonHint}>
              Katalog, Zapisi, veze, Collections, Memory Radio i Jingleportal
            </Text>
          </View>
          <Text style={styles.tutorialButtonChevron}>›</Text>
        </Pressable>

      </ScrollView>

      {/* settingsApplyNotesSpeedV1: Apply belongs to all appearance settings, not Boje. */}
      <View style={styles.applyDock}>
        <View style={styles.applyDockInner}>
          <View style={styles.applyDockCopy}>
            <Text style={styles.applyDockEyebrow}>IZGLED APLIKACIJE</Text>
            <Text numberOfLines={1} style={styles.applyDockHint}>
              Tema, katalog, radio i boje
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Primijeni promjene izgleda"
            disabled={saving}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.applyDockButton,
              { backgroundColor: accent },
              pressed && !saving && styles.pressed,
              saving && styles.applyDockButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.applyDockButtonText}>Primijeni</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* cloudSyncNoticeV1 */}
      <Modal
        animationType="fade"
        transparent
        visible={cloudNotice != null}
        onRequestClose={() => {
          if (!cloudBusy) setCloudNotice(null);
        }}
      >
        <View style={styles.syncNoticeOverlay}>
          <View style={styles.syncNoticeCard}>
            <View
              style={[
                styles.syncNoticeSignal,
                cloudNotice?.tone === 'CONFLICT' &&
                  styles.syncNoticeSignalConflict,
                cloudNotice?.tone === 'ERROR' &&
                  styles.syncNoticeSignalError,
              ]}
            >
              <View style={styles.syncNoticeSignalDot} />
              <View style={styles.syncNoticeSignalLine} />
              <View style={styles.syncNoticeSignalDot} />
            </View>

            <Text
              style={[
                styles.syncNoticeEyebrow,
                cloudNotice?.tone === 'ERROR' && {
                  color: colors.danger,
                },
              ]}
            >
              {cloudNotice?.eyebrow}
            </Text>

            <Text style={styles.syncNoticeTitle}>
              {cloudNotice?.title}
            </Text>

            <Text style={styles.syncNoticeCopy}>
              {cloudNotice?.copy}
            </Text>

            {cloudNotice?.allowPhoneCanonical ? (
              <View style={styles.syncNoticeChoice}>
                <Text style={styles.syncNoticeChoiceKicker}>
                  THIS PHONE
                </Text>
                <Text style={styles.syncNoticeChoiceTitle}>
                  Use current local database
                </Text>
                <Text style={styles.syncNoticeChoiceCopy}>
                  Upload this phone first, then remove every older cloud checkpoint.
                  Nothing on this phone will be overwritten.
                </Text>
              </View>
            ) : null}

            {cloudNotice?.allowPhoneCanonical ? (
              <View style={styles.checkpointNameBox}>
                <Text style={styles.checkpointNameLabel}>
                  CHECKPOINT NAME
                </Text>

                <TextInput
                  value={checkpointName}
                  onChangeText={setCheckpointName}
                  maxLength={32}
                  autoCapitalize="sentences"
                  placeholder="e.g. Post search repair"
                  placeholderTextColor={colors.textMuted}
                  style={styles.checkpointNameInput}
                />

                <Text style={styles.checkpointNameHint}>
                  Saved with the cloud revision. Revision number stays as technical metadata.
                </Text>
              </View>
            ) : null}

            {cloudNotice?.allowPhoneCanonical ? (
              <Pressable
                accessibilityRole="button"
                disabled={
                  cloudBusy ||
                  cloudHistoryBusy ||
                  checkpointName.trim().length === 0
                }
                onPress={() =>
                  void makeThisPhoneCanonical()
                }
                style={({ pressed }) => [
                  styles.syncNoticePrimary,
                  { backgroundColor: accent },
                  pressed &&
                    !cloudBusy &&
                    !cloudHistoryBusy &&
                    styles.pressed,
                ]}
              >
                {cloudBusy || cloudHistoryBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.syncNoticePrimaryText}>
                    USE THIS PHONE
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={cloudBusy}
                onPress={() => setCloudNotice(null)}
                style={({ pressed }) => [
                  styles.syncNoticePrimary,
                  { backgroundColor: accent },
                  pressed && !cloudBusy && styles.pressed,
                ]}
              >
                <Text style={styles.syncNoticePrimaryText}>
                  DONE
                </Text>
              </Pressable>
            )}

            {cloudNotice?.allowPhoneCanonical ? (
              <Pressable
                accessibilityRole="button"
                disabled={cloudBusy || cloudHistoryBusy}
                onPress={() => setCloudNotice(null)}
                style={({ pressed }) => [
                  styles.syncNoticeSecondary,
                  pressed &&
                    !cloudBusy &&
                    !cloudHistoryBusy &&
                    styles.pressed,
                ]}
              >
                <Text style={styles.syncNoticeSecondaryText}>
                  KEEP BOTH FOR NOW
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* themeRestartPromptV1 */}
      <Modal
        animationType="fade"
        transparent
        visible={restartPromptVisible}
        onRequestClose={() => {
          if (!restarting) setRestartPromptVisible(false);
        }}
      >
        <View style={styles.restartOverlay}>
          <View style={styles.restartCard}>
            <Text style={styles.restartEyebrow}>IZGLED SPREMLJEN</Text>
            <Text style={styles.restartTitle}>Primijeni novi izgled</Text>
            <Text style={styles.restartCopy}>
              Nova boja i vizualni svijet učitat će se nakon brzog ponovnog pokretanja aplikacije.
            </Text>

            {restartError ? (
              <Text style={styles.restartError}>{restartError}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={restarting}
              onPress={() => void restartAfterThemeSave()}
              style={({ pressed }) => [
                styles.restartButton,
                { backgroundColor: accent },
                pressed && !restarting && styles.pressed,
              ]}
            >
              {restarting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.restartButtonText}>Ponovno pokreni</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <FirstRunTutorial
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // finalSettingsDropdownsAstV18
  settingsAccordion: {
    marginBottom: 12,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  settingsAccordionCelestial: {
    shadowColor: colors.navy,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  settingsAccordionOpen: {
    borderColor: colors.navy,
  },
  settingsAccordionHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingsAccordionHeaderOpen: {
    backgroundColor: colors.fill,
  },
  settingsAccordionGlyph: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  settingsAccordionGlyphOpen: {
    backgroundColor: colors.surface,
    borderColor: colors.navy,
  },
  settingsAccordionGlyphText: {
    color: colors.navy,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  settingsAccordionCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  settingsAccordionTitle: {
    color: colors.text,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.15,
  },
  settingsAccordionSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  settingsAccordionChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  settingsAccordionChevronOpen: {
    borderColor: colors.navy,
    backgroundColor: colors.surface,
  },
  settingsAccordionChevronText: {
    color: colors.navy,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
  },
  settingsAccordionBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    gap: 12,
  },
  settingsAccordionStarRail: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  settingsAccordionRailLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.navy,
    opacity: 0.18,
  },
  settingsAccordionRailStar: {
    color: colors.navy,
    fontSize: 9,
    opacity: 0.72,
  },

  accentToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
    padding: 2,
    justifyContent: 'center',
  },
  accentToggleDisabled: {
    opacity: 0.42,
  },
  accentToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 2,
    transform: [{ translateX: 0 }],
  },
  accentToggleThumbOn: {
    transform: [{ translateX: 16 }],
  },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 32 },
  applyDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 11,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  applyDockInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  applyDockCopy: { flex: 1, minWidth: 0 },
  applyDockEyebrow: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  applyDockHint: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11.5,
  },
  applyDockButton: {
    minWidth: 138,
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  applyDockButtonDisabled: { opacity: 0.55 },
  applyDockButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  hero: { paddingHorizontal: 3, paddingBottom: 24 },
  eyebrow: { color: colors.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 38, lineHeight: 45, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 500 },
  section: { padding: 16, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  soundSettingRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  soundSettingCopy: { flex: 1 },
  soundSettingHint: { marginTop: 5, color: colors.textMuted, fontSize: 11.5, lineHeight: 17 },
  sectionLabel: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  skinGrid: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skinCard: { flexGrow: 1, flexBasis: 210, minHeight: 170, padding: 16, borderRadius: 18, backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.separator },
  skinCardSelected: { borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.surface },
  // ljingleTutorialMartyAeroRestoreR1:settings
  skinCardAero: {
    overflow: 'hidden',
    borderColor: '#A7DDF3',
    backgroundColor: '#DDF5FF',
    shadowColor: '#087CB8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  skinCardAeroSelected: { borderWidth: 2, borderColor: '#0B88C8', backgroundColor: '#DDF5FF' },
  skinTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skinCode: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  skinCodeSelected: { color: colors.navy },
  skinRadio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  skinRadioSelected: { borderWidth: 5, borderColor: colors.navy },
  skinSpecimen: { marginTop: 17, color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  skinName: { marginTop: 13, color: colors.text, fontSize: 17, fontWeight: '900' },
  skinDescription: { marginTop: 5, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  skinStatus: { marginTop: 13, color: colors.navy, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  skinAeroCode: { color: '#39768C' },
  skinAeroCodeSelected: { color: '#075F91' },
  skinAeroRadio: { borderColor: '#63B5D5' },
  skinAeroRadioSelected: { borderColor: '#0B88C8' },
  skinAeroPreview: {
    position: 'relative',
    height: 82,
    marginTop: 13,
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.96)',
    backgroundColor: '#BDEAF7',
  },
  skinAeroSun: { position: 'absolute', top: 10, right: 13, width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFF3A6' },
  skinAeroBubbleOne: { position: 'absolute', top: 16, left: 18, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.88)', backgroundColor: 'rgba(111,211,240,0.34)' },
  skinAeroBubbleTwo: { position: 'absolute', top: 35, left: 51, width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: 'rgba(255,255,255,0.18)' },
  skinAeroHillBack: { position: 'absolute', left: -22, right: 35, bottom: -30, height: 65, borderRadius: 50, backgroundColor: '#9BDD7E' },
  skinAeroHillFront: { position: 'absolute', left: 52, right: -32, bottom: -36, height: 72, borderRadius: 55, backgroundColor: '#65BF62' },
  skinAeroPreviewText: { position: 'absolute', left: 12, bottom: 9, color: '#075F91', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  skinAeroName: { color: '#123F55' },
  skinAeroDescription: { color: '#527386' },
  skinAeroStatus: { color: '#087CB8' },
  aeroBackgroundGrid: { marginTop: 14, flexDirection: 'row', gap: 12 },
  aeroBackgroundCard: { flex: 1, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.fill },
  aeroBackgroundCardSelected: { borderWidth: 2, backgroundColor: colors.surface },
  aeroBackgroundPreview: { width: '100%', height: 112 },
  aeroBackgroundCopy: { padding: 12 },
  aeroBackgroundTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aeroBackgroundName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  aeroBackgroundDescription: { marginTop: 5, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  radioThemeSection: { marginTop: 15 },
  radioThemeGrid: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  radioThemeCard: {
    flexGrow: 1,
    flexBasis: 230,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  radioThemeCardSelected: {
    borderWidth: 2,
    backgroundColor: colors.surface,
  },

  radioPreviewBody: {
    height: 92,
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  radioPreviewDisplay: {
    flex: 1,
    height: 57,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  radioPreviewLine: {
    width: '78%',
    height: 7,
    borderRadius: 4,
  },

  radioPreviewLineShort: {
    width: '48%',
    height: 5,
    borderRadius: 3,
    marginTop: 8,
    opacity: 0.58,
  },

  radioPreviewKnob: {
    width: 45,
    height: 45,
    borderRadius: 23,
    borderWidth: 4,
    alignItems: 'center',
  },

  radioPreviewKnobMark: {
    width: 3,
    height: 12,
    borderRadius: 2,
  },

  radioThemeCopy: {
    marginTop: 12,
  },

  radioThemeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  radioThemeName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },

  radioThemeDescription: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },

  displaySection: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  displayModeCode: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  displayModeGrid: { gap: 9 },
  displayModeCard: {
    minHeight: 92,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  displayModeCardSelected: {
    borderWidth: 2,
    borderColor: colors.navy,
    backgroundColor: colors.surface,
  },
  displayModeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  displayModeTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  displayModeCopy: { marginTop: 5, color: colors.textMuted, fontSize: 11.5, lineHeight: 17 },
  displayModeNote: { marginTop: 7, color: colors.navy, fontSize: 10, fontWeight: '800' },
  originalBackgroundButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  dualPresetSwatches: {
    width: 48,
    height: 34,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  dualPresetSwatch: { flex: 1 },
  originalBackgroundSwatch: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.separator,
    marginRight: 11,
  },
  originalBackgroundCopy: {
    flex: 1,
  },
  originalBackgroundTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  originalBackgroundValue: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  colorTargetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  colorTargetButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  colorTargetButtonSelected: {
    borderWidth: 2,
  },
  colorTargetDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  colorTargetText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  colorTargetTextSelected: {
    color: colors.text,
  },
  colorChip: { minWidth: 82, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10 },
  colorChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  colorMap: { width: '100%', aspectRatio: 1, overflow: 'hidden', borderRadius: 16, backgroundColor: '#000000' },
  mapPixels: { ...StyleSheet.absoluteFillObject },
  mapRow: { flex: 1, flexDirection: 'row' },
  mapPixel: { flex: 1 },
  mapCursor: { position: 'absolute', width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: 14, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'transparent', shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  hueLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  hueStrip: { height: 42, overflow: 'hidden', borderRadius: 12 },
  huePixels: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  huePixel: { flex: 1 },
  hueCursor: { position: 'absolute', top: 4, bottom: 4, width: 5, marginLeft: -2.5, borderRadius: 3, backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 3, elevation: 3 },
  previewCard: { flexDirection: 'row', alignItems: 'center', padding: 17, marginTop: 15, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  previewCopy: { flex: 1, paddingRight: 12 },
  previewEyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  previewTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 3 },
  previewSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  previewButton: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  previewButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  resetButton: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.fill },
  resetText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  saveButton: { flex: 1.25, minHeight: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  exportButton: {
    marginTop: 24,
    padding: 17,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  exportDisabled: { opacity: 0.55 },
  exportTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  exportCopy: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  backupBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  backupLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  backupInput: {
    minHeight: 220,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.fill,
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
    textAlignVertical: 'top',
  },
  copyButton: {
    minHeight: 48,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.black,
  },
  copyButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  exportSuccess: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  exportSuccessTitle: { color: colors.navy, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  exportSuccessFile: { marginTop: 4, color: colors.text, fontSize: 12, fontWeight: '800' },
  exportSuccessCopy: { marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  importBox: {
    marginTop: 12,
    padding: 17,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  importLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  importTitle: { marginTop: 5, color: colors.text, fontSize: 17, fontWeight: '900' },
  importCopy: { marginTop: 5, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  importButton: {
    minHeight: 50,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fill,
  },
  importButtonText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  importSelected: { marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: colors.fill },
  importFilename: { color: colors.text, fontSize: 13, fontWeight: '900' },
  importMeta: { marginTop: 4, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  importWarning: { marginTop: 7, color: colors.danger, fontSize: 11, lineHeight: 16 },
  restoreButton: {
    minHeight: 48,
    marginTop: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.black,
  },
  restoreButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  cloudHistoryHeader: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cloudHistoryHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cloudHistorySummary: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
  },
  cloudHistoryToggle: {
    minHeight: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
  cloudHistoryToggleText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  cloudLatest: {
    marginTop: 9,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  cloudLatestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cloudLatestCopy: {
    flex: 1,
    minWidth: 0,
  },
  cloudLatestKicker: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cloudLatestTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  cloudLatestRestore: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
  cloudLatestRestoreText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  cloudOlder: {
    marginTop: 2,
  },
  cloudOlderRow: {
    minHeight: 54,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  cloudOlderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cloudOlderTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  cloudOlderMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 8,
  },
  cloudOlderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cloudTextAction: {
    minHeight: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudTextActionText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '800',
  },
  cloudDeleteText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  tutorialButton: {
    minHeight: 74,
    marginHorizontal: 0,
    marginTop: 2,
    marginBottom: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  tutorialButtonMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.navy,
    backgroundColor: colors.surface,
  },
  tutorialButtonMarkText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  tutorialButtonCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  tutorialButtonTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  tutorialButtonHint: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 9.5,
    lineHeight: 14,
  },
  tutorialButtonChevron: {
    color: colors.navy,
    fontSize: 24,
  },
  importNote: { marginTop: 11, color: colors.textMuted, fontSize: 10.5, lineHeight: 16 },
  syncNoticeOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  syncNoticeCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  syncNoticeSignal: {
    width: 66,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  syncNoticeSignalConflict: {
    opacity: 0.72,
  },
  syncNoticeSignalError: {
    opacity: 0.48,
  },
  syncNoticeSignalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.navy,
  },
  syncNoticeSignalLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 7,
    backgroundColor: colors.separator,
  },
  syncNoticeEyebrow: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  syncNoticeTitle: {
    marginTop: 7,
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  syncNoticeCopy: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
  },
  syncNoticeChoice: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  syncNoticeChoiceKicker: {
    color: colors.navy,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  syncNoticeChoiceTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  syncNoticeChoiceCopy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  checkpointNameBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  checkpointNameLabel: {
    color: colors.navy,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  checkpointNameInput: {
    minHeight: 46,
    marginTop: 6,
    paddingHorizontal: 0,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  checkpointNameHint: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 9.5,
    lineHeight: 14,
  },
  syncNoticePrimary: {
    minHeight: 52,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  syncNoticePrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  syncNoticeSecondary: {
    minHeight: 42,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  syncNoticeSecondaryText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  restartOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  restartCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  restartEyebrow: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  restartTitle: {
    marginTop: 7,
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  restartCopy: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  restartError: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  restartButton: {
    minHeight: 52,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});



