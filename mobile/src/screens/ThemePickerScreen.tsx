import { useMemo, useState } from 'react';
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

const MAP_STEPS = 28;
const HUE_STEPS = 48;
const DEFAULT_ACCENT = '#1D1D1F';
const DEFAULT_BACKGROUND = '#F1F1F2';
const mapRows = Array.from({ length: MAP_STEPS }, (_, index) => index);
const mapColumns = Array.from({ length: MAP_STEPS }, (_, index) => index);
const hueStops = Array.from({ length: HUE_STEPS }, (_, index) => index);

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function ThemePickerScreen() {
  const [accent, setAccent] = useState(activeAccentColor);
  const [backgroundColor, setBackgroundColor] = useState(activeBackgroundColor);
  const [colorTarget, setColorTarget] = useState<'accent' | 'background'>('accent');
  const [visualSkin, setVisualSkin] = useState<VisualSkinId>(activeVisualSkinId);
  const [aeroBackground, setAeroBackground] =
    useState<AeroBackgroundId>(activeAeroBackgroundId);
  const [catalogueDisplayMode, setCatalogueDisplayMode] =
    useState<CatalogueDisplayMode>(getCatalogueDisplayMode());
  const [radioTheme, setRadioTheme] = useState<RadioThemeId>(activeRadioThemeId);
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Postavke</Text>
          <Text style={styles.heading}>Izgled</Text>
          <Text style={styles.intro}>
            Odaberi jednu boju. Aplikacija sama iz nje radi pozadine, obrube i gumbe.
          </Text>
        </View>

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
                    selected && styles.skinCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.skinTopRow}>
                    <Text style={[styles.skinCode, selected && styles.skinCodeSelected]}>{skin.shortName}</Text>
                    <View style={[styles.skinRadio, selected && styles.skinRadioSelected]} />
                  </View>
                  <Text style={styles.skinSpecimen}>{skin.specimen}</Text>
                  <Text style={styles.skinName}>{skin.name}</Text>
                  <Text style={styles.skinDescription}>{skin.description}</Text>
                  <Text style={styles.skinStatus}>{skin.id === 'classic' ? 'AKTIVAN DIZAJN' : 'TEMELJ SPREMAN'}</Text>
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
                  #F1F1F2 · RGB 241, 241, 242
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
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          >
            <Text style={styles.resetText}>Vrati zadano</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void save()}
            style={({ pressed }) => [styles.saveButton, { backgroundColor: accent }, pressed && styles.pressed]}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Primijeni</Text>}
          </Pressable>
        </View>

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

      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  hero: { paddingHorizontal: 3, paddingBottom: 24 },
  eyebrow: { color: colors.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 38, lineHeight: 45, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 500 },
  section: { padding: 16, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionLabel: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  skinGrid: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skinCard: { flexGrow: 1, flexBasis: 210, minHeight: 170, padding: 16, borderRadius: 18, backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.separator },
  skinCardSelected: { borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.surface },
  skinTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skinCode: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  skinCodeSelected: { color: colors.navy },
  skinRadio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  skinRadioSelected: { borderWidth: 5, borderColor: colors.navy },
  skinSpecimen: { marginTop: 17, color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  skinName: { marginTop: 13, color: colors.text, fontSize: 17, fontWeight: '900' },
  skinDescription: { marginTop: 5, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  skinStatus: { marginTop: 13, color: colors.navy, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
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
  importNote: { marginTop: 11, color: colors.textMuted, fontSize: 10.5, lineHeight: 16 },
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





