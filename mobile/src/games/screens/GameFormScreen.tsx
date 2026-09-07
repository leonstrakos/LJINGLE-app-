import { useEffect, useState } from 'react';
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
import { AeroAtmosphere } from '../../components/AeroAtmosphere';

import { FeedbackView } from '../../components/FeedbackView';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import { gameApi } from '../services/gameApi';
import { createdFeedback } from '../../utils/crudFeedback';
import { triggerCompletionCelebration } from '../../services/completionCelebration';
// completionCelebrationR1:game-form
import {
  enjoymentLabels,
  enjoymentOptions,
  gameStatusLabels,
  gameStatuses,
  type Enjoyment,
  type GameRequest,
  type GameStackParamList,
  type GameStatus,
} from '../types/game';

type Props = NativeStackScreenProps<GameStackParamList, 'GameForm'>;

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words';
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98989D"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function GameFormScreen({ route, navigation }: Props) {
  const gameId = route.params?.gameId;
  const prefill = route.params?.prefill;
  const editing = Boolean(gameId);

  const [title, setTitle] = useState(prefill?.title ?? '');
  const [developer, setDeveloper] = useState(prefill?.developer ?? '');
  const [platform, setPlatform] = useState(prefill?.platforms[0] ?? '');
  const [releaseYear, setReleaseYear] = useState(prefill?.releaseYear ? String(prefill.releaseYear) : '');
  const [gameStatus, setGameStatus] = useState<GameStatus>('BACKLOG');
  const [initialGameStatus, setInitialGameStatus] = useState<GameStatus | null>(null);
  const [progress, setProgress] = useState('0');
  const [enjoyment, setEnjoyment] = useState<Enjoyment | null>(null);
  const [favourite, setFavourite] = useState(false);
  const [startedOn, setStartedOn] = useState('');
  const [finishedOn, setFinishedOn] = useState('');
  const [coverUrl, setCoverUrl] = useState(prefill?.coverUrl ?? '');
  const [igdbId, setIgdbId] = useState<number | null>(prefill?.igdbId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const loadGame = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const game = await gameApi.getById(gameId);
        setTitle(game.title);
        setDeveloper(game.developer ?? '');
        setPlatform(game.platform);
        setReleaseYear(game.releaseYear ? String(game.releaseYear) : '');
        setGameStatus(game.gameStatus);
        setInitialGameStatus(game.gameStatus);
        setProgress(String(game.progress));
        setEnjoyment(game.enjoyment);
        setFavourite(game.favourite);
        setStartedOn(game.startedOn ?? '');
        setFinishedOn(game.finishedOn ?? '');
        setCoverUrl(game.coverUrl ?? '');
        setIgdbId(game.igdbId);
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : 'Dohvat igre nije uspio.');
      } finally {
        setLoading(false);
      }
    };

    void loadGame();
  }, [gameId]);

  const validate = (): GameRequest | null => {
    const nextErrors: Record<string, string> = {};
    const numericProgress = Number(progress);
    const numericYear = releaseYear ? Number(releaseYear) : null;

    if (!title.trim()) nextErrors.title = 'Naslov ne smije biti prazan.';
    if (!platform.trim()) nextErrors.platform = 'Platforma ne smije biti prazna.';
    if (numericYear !== null && (!Number.isInteger(numericYear) || numericYear < 0 || numericYear > 3000)) {
      nextErrors.releaseYear = 'Unesite valjanu godinu između 0 i 3000.';
    }
    if (!progress.trim() || !Number.isInteger(numericProgress)) {
      nextErrors.progress = 'Unesite cijeli postotak.';
    } else if (numericProgress < 0 || numericProgress > 100) {
      nextErrors.progress = 'Napredak mora biti između 0 i 100.';
    }
    if (startedOn && !isValidIsoDate(startedOn)) {
      nextErrors.startedOn = 'Koristite valjani datum u obliku GGGG-MM-DD.';
    }
    if (finishedOn && !isValidIsoDate(finishedOn)) {
      nextErrors.finishedOn = 'Koristite valjani datum u obliku GGGG-MM-DD.';
    }
    if (!nextErrors.startedOn && !nextErrors.finishedOn && startedOn && finishedOn && finishedOn < startedOn) {
      nextErrors.finishedOn = 'Datum završetka ne može biti prije početka.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      title: title.trim(),
      developer: developer.trim() || null,
      platform: platform.trim(),
      releaseYear: numericYear,
      gameStatus,
      progress: numericProgress,
      enjoyment,
      favourite,
      startedOn: startedOn || null,
      finishedOn: finishedOn || null,
      igdbId,
      coverUrl: coverUrl.trim() || null,
    };
  };

  const save = async () => {
    const payload = validate();
    if (!payload) return;
    setSaving(true);
    try {
      if (gameId) {
        await gameApi.update(gameId, payload);
        if (
          initialGameStatus !== null &&
          initialGameStatus !== 'COMPLETED' &&
          payload.gameStatus === 'COMPLETED'
        ) {
          triggerCompletionCelebration({
            kind: 'GAME',
            title: payload.title,
          });
        }
      } else {
        await gameApi.create(payload);

        createdFeedback();
      }
      navigation.popToTop();
    } catch (caught) {
      Alert.alert(
        'Spremanje nije uspjelo',
        caught instanceof Error ? caught.message : 'Pokušajte ponovno.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FeedbackView type="loading" message="Učitavanje igre…" />;
  if (loadError) return <FeedbackView type="error" message={loadError} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="games" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{editing ? 'Uređivanje' : prefill ? 'Online rezultat' : 'Dodavanje'}</Text>
            <Text style={styles.heading}>{editing ? 'Uredi igru' : 'Nova igra'}</Text>
            <Text style={styles.introText}>
              {prefill
                ? 'Provjeri metapodatke i odaberi platformu prije spremanja.'
                : 'Osobni statusi i vrijeme igranja ostaju tvoji podaci.'}
            </Text>
          </View>

          <View style={styles.formCard}>
            <FormField
              label="Naslov *"
              value={title}
              onChangeText={(value) => { setTitle(value); setErrors((current) => ({ ...current, title: '' })); }}
              placeholder="npr. Fortnite"
              error={errors.title}
            />
            <FormField
              label="Razvojni studio"
              value={developer}
              onChangeText={setDeveloper}
              placeholder="npr. ZA/UM"
              autoCapitalize="words"
            />
            <FormField
              label="Platforma *"
              value={platform}
              onChangeText={(value) => { setPlatform(value); setErrors((current) => ({ ...current, platform: '' })); }}
              placeholder="npr. PC, PlayStation 5, Switch"
              error={errors.platform}
              autoCapitalize="words"
            />
            {prefill && prefill.platforms.length > 1 ? (
              <View style={styles.platformChoices}>
                {prefill.platforms.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setPlatform(option)}
                    style={[styles.choice, platform === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, platform === option && styles.choiceTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <FormField
              label="Godina izlaska"
              value={releaseYear}
              onChangeText={(value) => { setReleaseYear(value.replace(/[^0-9]/g, '')); setErrors((current) => ({ ...current, releaseYear: '' })); }}
              placeholder="npr. 2019"
              keyboardType="number-pad"
              autoCapitalize="none"
              error={errors.releaseYear}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.choiceList}>
                {gameStatuses.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
setGameStatus(option);
                    }}
                    style={[styles.choice, gameStatus === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, gameStatus === option && styles.choiceTextSelected]}>
                      {gameStatusLabels[option]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <FormField
              label="Napredak (%)"
              value={progress}
              onChangeText={(value) => { setProgress(value.replace(/[^0-9]/g, '')); setErrors((current) => ({ ...current, progress: '' })); }}
              placeholder="0–100"
              keyboardType="number-pad"
              autoCapitalize="none"
              error={errors.progress}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Kako ti je bilo?</Text>
              <View style={styles.choiceList}>
                {enjoymentOptions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setEnjoyment(enjoyment === option ? null : option)}
                    style={[styles.choice, enjoyment === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, enjoyment === option && styles.choiceTextSelected]}>
                      {enjoymentLabels[option]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <FormField
              label="Datum početka"
              value={startedOn}
              onChangeText={(value) => { setStartedOn(value); setErrors((current) => ({ ...current, startedOn: '', finishedOn: '' })); }}
              placeholder="GGGG-MM-DD"
              autoCapitalize="none"
              error={errors.startedOn}
            />
            <FormField
              label="Datum završetka"
              value={finishedOn}
              onChangeText={(value) => { setFinishedOn(value); setErrors((current) => ({ ...current, finishedOn: '' })); }}
              placeholder="GGGG-MM-DD"
              autoCapitalize="none"
              error={errors.finishedOn}
            />
            <FormField
              label="Adresa naslovnice"
              value={coverUrl}
              onChangeText={setCoverUrl}
              placeholder="https://…"
              keyboardType="url"
              autoCapitalize="none"
            />


          </View>

          <PrimaryButton
            label={editing ? 'Spremi promjene' : 'Dodaj igru'}
            onPress={() => void save()}
            loading={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 44 },
  intro: { marginBottom: 18 },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 31, lineHeight: 38, fontWeight: '800', marginTop: 3 },
  introText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 18,
    padding: 17,
    marginBottom: 18,
  },
  field: { marginBottom: 18 },
  label: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 6 },
  choiceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8, marginBottom: 18 },
  choice: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  choiceSelected: { backgroundColor: colors.black, borderColor: colors.black },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: colors.onAccent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchCopy: { flex: 1 },
  switchHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});

// catalogueJingleProgressSemanticsV1
