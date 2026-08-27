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

  const [inviteCode, setInviteCode] =
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
    return <>{children}</>;
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
          inviteCode,
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
        <View style={styles.shell}>
          <Text style={styles.wordmark}>
            LJINGLE
          </Text>

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
              : 'Registration is invite-only during the LJingle beta.'}
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

              <View style={styles.field}>
                <Text style={styles.label}>
                  INVITE CODE
                </Text>
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
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
                ? 'HAVE AN INVITE? CREATE ACCOUNT'
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 42,
    backgroundColor: colors.background,
  },
  shell: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  wordmark: {
    color: colors.black,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 4.2,
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
    marginTop: 42,
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
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 0,
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
    backgroundColor: colors.black,
    borderRadius: 4,
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
