// forkDTopicsV1
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ActivityCreateForm } from './ActivityCreateForm';
import { colors } from '../theme/colors';
import type { ActivityType } from '../types/topic';

type Props = {
  visible: boolean;
  label: string;
  activityType: ActivityType;
  saving: boolean;
  errorMessage?: string | null;
  onLabelChange: (value: string) => void;
  onTypeChange: (value: ActivityType) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const OPEN_MS = 170;
const CLOSE_MS = 140;

export function TopicActivityCreateSheet({
  visible,
  label,
  activityType,
  saving,
  errorMessage,
  onLabelChange,
  onTypeChange,
  onClose,
  onSubmit,
}: Props) {
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();

    if (visible) {
      setRendered(true);
      progress.setValue(0);

      const frame = requestAnimationFrame(() => {
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });

      return () => cancelAnimationFrame(frame);
    }

    Keyboard.dismiss();
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });

    return undefined;
  }, [progress, visible]);

  const requestClose = () => {
    if (saving) return;
    Keyboard.dismiss();
    onClose();
  };

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [54, 0],
  });

  if (!rendered) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
      transparent
      visible={rendered}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: progress }]}
        />

        <Pressable
          accessibilityLabel="Zatvori novu aktivnost"
          accessibilityRole="button"
          onPress={requestClose}
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.sheetHost}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: progress,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ActivityCreateForm
                activityType={activityType}
                errorMessage={errorMessage}
                label={label}
                onCancel={requestClose}
                onLabelChange={onLabelChange}
                onSubmit={onSubmit}
                onTypeChange={onTypeChange}
                saving={saving}
              />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  sheetHost: {
    flex: 1,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4,
    marginTop: 9,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: colors.separator,
  },
  content: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
});
