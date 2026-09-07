// ljingleZodiacPlayR1
import {
  type PropsWithChildren,
  useState,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { useAuth } from './AuthContext';
import { BirthdayGate } from './BirthdayFeature';

type Mode = 'login' | 'register';

function messageFor(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

export function AuthGate({
  children,
}: PropsWithChildren) {
  const {
    user,
    loading,
    login,
    register,
  } = useAuth();

  const [mode, setMode] =
    useState<Mode>('login');

  const [loginValue, setLoginValue] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [username, setUsername] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.wordmark}>
          LJINGLE
        </Text>
        <ActivityIndicator />
      </View>
    );
  }

  if (user) {
    return <BirthdayGate key={user.id} userId={user.id}>{children}</BirthdayGate>;
  }

  const submit = async () => {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      if (mode === 'login') {
        await login(
          loginValue,
          password,
        );
      } else {
        await register({
          email,
          username,
          password,
        });
      }
    } catch (submitError) {
      setError(
        messageFor(submitError),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <View pointerEvents="none" style={styles.sky}>
          <View style={[styles.star, styles.starOne]}><Text style={styles.starText}>✦</Text></View>
          <View style={[styles.star, styles.starTwo]}><Text style={styles.starText}>✧</Text></View>
          <View style={[styles.star, styles.starThree]}><Text style={styles.starText}>·</Text></View>
          <View style={styles.constellationLineOne} />
          <View style={styles.constellationLineTwo} />
        </View>

        <View style={styles.shell}>
          <View accessibilityLabel="LJingle" style={styles.brand}>
            <Text style={styles.crownStar}>✦</Text>
            <View style={styles.bellMark}>
              <View style={styles.bellLoop} />
              <View style={styles.bellCrown} />
              <View style={styles.bellBody}>
                <Text style={styles.bellStar}>✦</Text>
              </View>
              <View style={styles.bellRim} />
              <View style={styles.bellClapper} />
            </View>
            <Text style={styles.wordmark}>LJINGLE</Text>
            <View style={styles.brandRule}>
              <View style={styles.brandRuleLine} />
              <Text style={styles.brandRuleStar}>✦</Text>
              <View style={styles.brandRuleLine} />
            </View>
          </View>

          <Text style={styles.eyebrow}>
            YOUR PERSONAL CATALOGUE
          </Text>

          <Text style={styles.title}>
            {mode === 'login'
              ? 'Welcome back.'
              : 'Create your archive.'}
          </Text>

          <Text style={styles.copy}>
            {mode === 'login'
              ? 'Sign in to unlock this installation and your private cloud backup.'
              : 'Create an account and begin your own private archive.'}
          </Text>

          {mode === 'login' ? (
            <View style={styles.field}>
              <Text style={styles.label}>
                EMAIL / USERNAME
              </Text>
              <TextInput
                value={loginValue}
                onChangeText={setLoginValue}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                style={styles.input}
              />
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>
                  EMAIL
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  USERNAME
                </Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  style={styles.input}
                />
              </View>

            </>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>
              PASSWORD
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              style={styles.input}
              onSubmitEditing={() => {
                void submit();
              }}
            />
          </View>

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void submit();
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator
                color={colors.surface}
              />
            ) : (
              <Text
                style={styles.primaryText}
              >
                {mode === 'login'
                  ? 'SIGN IN'
                  : 'CREATE ACCOUNT'}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError('');
              setPassword('');
              setMode(
                mode === 'login'
                  ? 'register'
                  : 'login',
              );
            }}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={styles.secondaryText}
            >
              {mode === 'login'
                ? 'NEW HERE? CREATE ACCOUNT'
                : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}
            </Text>
          </Pressable>

          <Text style={styles.safety}>
            One account per installation protects the local SQLite archive from account switching.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const NAVY = '#13264A';
const GOLD = '#C89A3D';
const IVORY = '#FBF7EE';

const styles = StyleSheet.create({
  sky: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  star: { position: 'absolute' },
  starText: { color: GOLD, fontSize: 18 },
  starOne: { left: '9%', top: 72 },
  starTwo: { right: '12%', top: 126 },
  starThree: { left: '17%', top: 180 },
  constellationLineOne: { position: 'absolute', left: '9%', top: 93, width: 84, height: 1, backgroundColor: GOLD, opacity: 0.35, transform: [{ rotate: '18deg' }] },
  constellationLineTwo: { position: 'absolute', right: '9%', top: 154, width: 70, height: 1, backgroundColor: GOLD, opacity: 0.28, transform: [{ rotate: '-24deg' }] },
  brand: { alignItems: 'center', marginBottom: 4 },
  crownStar: { color: GOLD, fontSize: 25, lineHeight: 27 },
  bellMark: { width: 82, height: 92, alignItems: 'center', position: 'relative' },
  bellLoop: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: NAVY },
  bellCrown: { width: 48, height: 18, marginTop: -3, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 2, borderBottomWidth: 0, borderColor: NAVY },
  bellBody: { width: 62, height: 46, marginTop: -1, borderBottomLeftRadius: 31, borderBottomRightRadius: 31, borderWidth: 2, borderTopWidth: 0, borderColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  bellStar: { color: GOLD, fontSize: 18, marginTop: -3 },
  bellRim: { position: 'absolute', left: 7, right: 7, top: 62, height: 2, backgroundColor: NAVY },
  bellClapper: { position: 'absolute', bottom: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  brandRuleLine: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: GOLD },
  brandRuleStar: { color: GOLD, fontSize: 13, marginHorizontal: 8 },
  flex: {
    flex: 1,
    backgroundColor: IVORY,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: IVORY,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 42,
    backgroundColor: IVORY,
  },
  shell: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 26,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    backgroundColor: 'rgba(255,252,246,0.94)',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 5,
  }, // authVisualCardCelestialV1
  wordmark: {
    color: NAVY,
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: 7.5,
    marginLeft: 7.5,
  },
  eyebrow: {
    marginTop: 10,
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    opacity: 0.55,
  },
  title: {
    marginTop: 28,
    color: colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  copy: {
    marginTop: 10,
    marginBottom: 30,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.66,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    opacity: 0.62,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(19,38,74,0.18)',
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.72)',
    color: NAVY,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  error: {
    marginTop: 2,
    marginBottom: 18,
    color: '#A12A2A',
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: NAVY,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD,
  },
  primaryText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  safety: {
    marginTop: 28,
    color: colors.text,
    fontSize: 11,
    lineHeight: 17,
    opacity: 0.45,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.55,
  },
});
