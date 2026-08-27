import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaFeedbackView } from '../components/MediaFeedbackView';
import { PrimaryButton } from '../components/PrimaryButton';
import { mediaApi } from '../services/mediaApi';
import { colors } from '../theme/colors';
import { semanticFeedback } from '../utils/semanticFeedback';
import {
  mediaEnjoymentLabels,
  mediaEnjoymentOptions,
  mediaTypeLabels,
  mediaTypes,
  watchStatusLabels,
  watchStatuses,
  type MediaEnjoyment,
  type MediaRequest,
  type MediaType,
  type WatchStatus,
} from '../types/media';
import type { MediaStackParamList } from '../types/mediaNavigation';
import { createdFeedback } from '../utils/crudFeedback';

import {
  seriesApi,
  type ManualSeriesEpisodeInput,
} from '../services/seriesApi';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaForm'>;

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// // catalogueJingleProgressSemanticsV1:EpisodeDraft
function formatEpisodeDraft(
  episodes: Array<{
    seasonNumber: number;
    episodeNumber: number;
    name: string;
  }>,
) {
  return episodes
    .map(
      (episode) =>
        `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')} | ${episode.name}`,
    )
    .join('\n');
}

function parseManualEpisodes(
  value: string,
): {
  episodes: ManualSeriesEpisodeInput[];
  error: string | null;
} {
  const lines =
    value
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim(),
      )
      .filter(Boolean);

  const episodes:
    ManualSeriesEpisodeInput[] = [];

  const seen =
    new Set<string>();

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line =
      lines[index]!;

    const coded =
      line.match(
        /^S?(\d{1,3})\s*E(\d{1,4})\s*(?:[|—–-]\s*)?(.*)$/i,
      );

    const xStyle =
      line.match(
        /^(\d{1,3})\s*[xX]\s*(\d{1,4})\s*(?:[|—–-]\s*)?(.*)$/,
      );

    const match =
      coded ??
      xStyle;

    const seasonNumber =
      match
        ? Number(match[1])
        : 1;

    const episodeNumber =
      match
        ? Number(match[2])
        : index + 1;

    const rawName =
      match
        ? String(match[3] ?? '').trim()
        : line;

    if (
      !Number.isInteger(seasonNumber) ||
      seasonNumber <= 0 ||
      !Number.isInteger(episodeNumber) ||
      episodeNumber <= 0
    ) {
      return {
        episodes: [],
        error:
          `Ne mogu pročitati red ${index + 1}. Koristi npr. S01E01 | Naziv epizode.`,
      };
    }

    const key =
      `${seasonNumber}:${episodeNumber}`;

    if (seen.has(key)) {
      return {
        episodes: [],
        error:
          `Epizoda S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')} je unesena dvaput.`,
      };
    }

    seen.add(key);

    episodes.push({
      seasonNumber,
      episodeNumber,
      name:
        rawName ||
        `Epizoda ${episodeNumber}`,
    });
  }

  return {
    episodes,
    error: null,
  };
}

export function MediaFormScreen({ route, navigation }: Props) {
  const mediaId = route.params?.mediaId;
  const draft = route.params?.draft;
  const editing = Boolean(mediaId);

  const [mediaType, setMediaType] = useState<MediaType>(draft?.mediaType ?? 'MOVIE');
  const [tmdbId, setTmdbId] = useState<number | null>(draft?.tmdbId ?? null);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [originalTitle, setOriginalTitle] = useState(draft?.originalTitle ?? '');
  const [overview, setOverview] = useState(draft?.overview ?? '');
  const [posterPath, setPosterPath] = useState<string | null>(draft?.posterPath ?? null);
  const [backdropPath, setBackdropPath] = useState<string | null>(draft?.backdropPath ?? null);
  const [releaseYear, setReleaseYear] = useState(draft?.releaseYear ? String(draft.releaseYear) : '');
  const [watchStatus, setWatchStatus] = useState<WatchStatus>('WATCHLIST');
  // // catalogueJingleProgressSemanticsV1:MediaProgress
  // Hidden legacy/derived value only. Movies use status; series use episodes.
  const [progress, setProgress] = useState('0');
  const [episodeDraft, setEpisodeDraft] = useState('');
  const [enjoyment, setEnjoyment] = useState<MediaEnjoyment | null>(null);
  const [favourite, setFavourite] = useState(false);
  const [startedOn, setStartedOn] = useState('');
  const [completedOn, setCompletedOn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mediaId) return;
    setLoading(true);
    setLoadError(null);
    void mediaApi.getById(mediaId)
      .then(async (item) => {
        setMediaType(item.mediaType);
        setTmdbId(item.tmdbId);
        setTitle(item.title);
        setOriginalTitle(item.originalTitle ?? '');
        setOverview(item.overview ?? '');
        setPosterPath(item.posterPath);
        setBackdropPath(item.backdropPath);
        setReleaseYear(item.releaseYear ? String(item.releaseYear) : '');
        setWatchStatus(item.watchStatus);
        setProgress(String(item.progress));
        setEnjoyment(item.enjoyment);
        setFavourite(item.favourite);
        setStartedOn(item.startedOn ?? '');
        setCompletedOn(item.completedOn ?? '');

        if (item.mediaType === 'SERIES') {
          const seriesProgress =
            await seriesApi.getProgress(
              item.mediaId,
            );

          setEpisodeDraft(
            formatEpisodeDraft(
              seriesProgress.episodes,
            ),
          );
        }
      })
      .catch((caught: unknown) => {
        setLoadError(caught instanceof Error ? caught.message : 'Dohvat naslova nije uspio.');
      })
      .finally(() => setLoading(false));
  }, [mediaId]);

  const validate = (): MediaRequest | null => {
    const next: Record<string, string> = {};
    const numericYear = releaseYear ? Number(releaseYear) : null;
    const storedProgress =
      Number(progress);

    if (!title.trim()) next.title = 'Naslov je obvezan.';
    if (numericYear !== null && (!Number.isInteger(numericYear) || numericYear < 1800 || numericYear > 3000)) {
      next.releaseYear = 'Godina mora biti između 1800 i 3000.';
    }
    if (startedOn && !validDate(startedOn)) next.startedOn = 'Koristite datum GGGG-MM-DD.';
    if (completedOn && !validDate(completedOn)) next.completedOn = 'Koristite datum GGGG-MM-DD.';
    if (!next.startedOn && !next.completedOn && startedOn && completedOn && completedOn < startedOn) {
      next.completedOn = 'Završetak ne može biti prije početka.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      mediaType,
      tmdbId,
      title: title.trim(),
      originalTitle: originalTitle.trim() || null,
      overview: overview.trim() || null,
      posterPath,
      backdropPath,
      releaseYear: numericYear,
      watchStatus,
      progress:
        mediaType === 'MOVIE'
          ? watchStatus === 'COMPLETED'
            ? 100
            : 0
          : Number.isFinite(storedProgress)
            ? storedProgress
            : 0,
      enjoyment,
      favourite,
      startedOn: startedOn || null,
      completedOn: completedOn || null,
    };
  };

  const save = async () => {
    const payload = validate();
    if (!payload) return;

    const parsedEpisodes =
      mediaType === 'SERIES'
        ? parseManualEpisodes(
            episodeDraft,
          )
        : {
            episodes: [],
            error: null,
          };

    if (parsedEpisodes.error) {
      setErrors((current) => ({
        ...current,
        episodes:
          parsedEpisodes.error!,
      }));
      return;
    }

    setSaving(true);
    try {
      if (mediaId) {
        await mediaApi.update(mediaId, payload);

        if (
          mediaType === 'SERIES' &&
          parsedEpisodes.episodes.length
        ) {
          await seriesApi.upsertManualEpisodes(
            mediaId,
            parsedEpisodes.episodes,
          );
        }

        navigation.goBack();
      } else {
        const created = await mediaApi.create(payload);

        if (
          mediaType === 'SERIES' &&
          parsedEpisodes.episodes.length
        ) {
          await seriesApi.upsertManualEpisodes(
            created.mediaId,
            parsedEpisodes.episodes,
          );
        }

        createdFeedback();
        navigation.replace('MediaDetails', { mediaId: created.mediaId });
      }
    } catch (caught) {
      Alert.alert('Spremanje nije uspjelo', caught instanceof Error ? caught.message : 'Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <MediaFeedbackView type="loading" message="Učitavanje podataka…" />;
  if (loadError) return <MediaFeedbackView type="error" message={loadError} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>{editing ? 'Uređivanje' : draft ? 'Online rezultat' : 'Ručni unos'}</Text>
          <Text style={styles.heading}>{editing ? 'Uredi naslov' : 'Dodaj film ili seriju'}</Text>

          <Section label="Vrsta">
            <ChipRow>
              {mediaTypes.map((value) => (
                <ChoiceChip key={value} label={mediaTypeLabels[value]} active={mediaType === value} disabled={Boolean(draft || editing)} onPress={() => setMediaType(value)} />
              ))}
            </ChipRow>
          </Section>

          <View style={styles.card}>
            <FormField label="Naslov *" value={title} onChangeText={setTitle} placeholder="Naslov" error={errors.title} />
            <FormField label="Izvorni naslov" value={originalTitle} onChangeText={setOriginalTitle} placeholder="Nije obvezno" />
            <FormField label="Godina izdanja" value={releaseYear} onChangeText={(value) => setReleaseYear(value.replace(/[^0-9]/g, ''))} placeholder="npr. 1999" keyboardType="number-pad" error={errors.releaseYear} />
            <Text style={styles.fieldLabel}>Opis</Text>
            <TextInput value={overview} onChangeText={setOverview} placeholder="Kratak opis" placeholderTextColor="#98989D" multiline style={[styles.input, styles.multiline]} />
            {tmdbId ? <Text style={styles.tmdbNote}>Izvor #{tmdbId} · metapodaci ostaju odvojeni od osobnog praćenja.</Text> : null}
          </View>

          <Section label="Status gledanja">
            <ChipRow>
              {watchStatuses.map((value) => (
                <ChoiceChip key={value} label={watchStatusLabels[value]} active={watchStatus === value} onPress={() => {
                  if (value === 'COMPLETED' && watchStatus !== 'COMPLETED') {
                    // semanticCompletionFeedbackV1
                    void semanticFeedback.complete();
                  }
                  setWatchStatus(value);
                }} />
              ))}
            </ChipRow>
          </Section>

          <View style={styles.card}>
            {mediaType === 'SERIES' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  Epizode (ručno)
                </Text>

                <TextInput
                  value={episodeDraft}
                  onChangeText={(value) => {
                    setEpisodeDraft(value);
                    setErrors((current) => ({
                      ...current,
                      episodes: '',
                    }));
                  }}
                  placeholder={'S01E01 | Naziv epizode\nS01E02 | Naziv epizode'}
                  placeholderTextColor="#98989D"
                  multiline
                  autoCapitalize="sentences"
                  style={[
                    styles.input,
                    styles.episodeInput,
                    errors.episodes && styles.inputError,
                  ]}
                />

                {errors.episodes ? (
                  <Text style={styles.error}>
                    {errors.episodes}
                  </Text>
                ) : null}

                <Text style={styles.episodeHint}>
                  Jedan red = jedna epizoda. Broj i postotak računaju se iz popisa i oznaka gledano.
                </Text>
              </View>
            ) : null}

            <FormField label="Datum početka" value={startedOn} onChangeText={setStartedOn} placeholder="GGGG-MM-DD" error={errors.startedOn} />
            <FormField label="Datum završetka" value={completedOn} onChangeText={setCompletedOn} placeholder="GGGG-MM-DD" error={errors.completedOn} />
          </View>

          <Section label="Dojam">
            <ChipRow>
              <ChoiceChip label="Nije ocijenjeno" active={enjoyment === null} onPress={() => setEnjoyment(null)} />
              {mediaEnjoymentOptions.map((value) => (
                <ChoiceChip key={value} label={mediaEnjoymentLabels[value]} active={enjoyment === value} onPress={() => setEnjoyment(value)} />
              ))}
            </ChipRow>
          </Section>

          <View style={styles.saveButton}>
            <PrimaryButton label={editing ? 'Spremi promjene' : 'Dodaj u katalog'} loading={saving} onPress={() => void save()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  error?: string;
};

function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default', error }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98989D" keyboardType={keyboardType} style={[styles.input, error && styles.inputError]} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionLabel}>{label}</Text>{children}</View>;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function ChoiceChip({ label, active, onPress, disabled = false }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 45 },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -0.6, marginTop: 3, marginBottom: 18 },
  card: { padding: 17, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  field: { marginBottom: 16 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 49, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.separator, color: colors.text, fontSize: 15 },
  multiline: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
  // // catalogueJingleProgressSemanticsV1:EpisodeEditor
  episodeInput: {
    minHeight: 180,
    paddingTop: 13,
    textAlignVertical: 'top',
  },
  episodeHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 7,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  tmdbNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 12 },
  section: { marginBottom: 18 },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 9 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipDisabled: { opacity: 0.72 },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 3 },
  switchTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  switchSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  saveButton: { marginTop: 8 },
});

// catalogueJingleProgressSemanticsV1
