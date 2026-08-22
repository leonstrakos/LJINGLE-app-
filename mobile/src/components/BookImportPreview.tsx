import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { BookImportPreviewResponse } from '../types/bookMetadata';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  preview: BookImportPreviewResponse;
  loading?: boolean;
  onConfirm: (confirmMetadataUpdate: boolean) => void;
  onCancel: () => void;
};

const fieldLabels: Record<string, string> = {
  title: 'naslov',
  author: 'autor',
  isbn: 'ISBN',
  publishedYear: 'godina izdanja',
  readingStatus: 'status čitanja',
  progress: 'napredak',
  enjoyment: 'dojam',
  favourite: 'favorit',
  startedOn: 'datum početka',
  finishedOn: 'datum završetka',
  activities: 'aktivnosti',
  timeHistory: 'povijest vremena',
};

export function BookImportPreview({
  preview,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [preview]);

  const isUpdate = preview.action === 'UPDATE_EXISTING';
  const canSubmit = preview.importable && preview.action !== 'BLOCKED' && !(
    preview.confirmationRequired && !confirmed
  );

  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>PREGLED UVOZA</Text>
      <Text style={styles.title}>{preview.candidate.title}</Text>
      <Text style={styles.author}>{preview.candidate.authors.join(', ')}</Text>

      {preview.existingBook ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            {preview.action === 'ALREADY_IMPORTED'
              ? 'Knjiga je već u katalogu'
              : 'Pronađen je postojeći zapis'}
          </Text>
          <Text style={styles.noticeText}>
            {preview.existingBook.title} · {preview.existingBook.author}
          </Text>
        </View>
      ) : null}

      {preview.changedBibliographicFields.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bibliografska polja</Text>
          <Text style={styles.body}>
            {preview.changedBibliographicFields.map((field) => fieldLabels[field] ?? field).join(', ')}
          </Text>
        </View>
      ) : null}

      <View style={styles.protectedBox}>
        <Text style={styles.protectedTitle}>Osobni podaci ostaju netaknuti</Text>
        <Text style={styles.protectedText}>
          {preview.protectedPersonalFields.map((field) => fieldLabels[field] ?? field).join(', ')}.
        </Text>
      </View>

      {preview.warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>• {warning}</Text>
      ))}

      {isUpdate ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmed }}
          onPress={() => setConfirmed((current) => !current)}
          style={styles.confirmRow}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            <Text style={styles.checkmark}>{confirmed ? '✓' : ''}</Text>
          </View>
          <Text style={styles.confirmText}>
            Potvrđujem zamjenu samo navedenih bibliografskih polja.
          </Text>
        </Pressable>
      ) : null}

      {preview.action !== 'ALREADY_IMPORTED' ? (
        <PrimaryButton
          disabled={!canSubmit}
          label={isUpdate ? 'Potvrdi bibliografske promjene' : 'Dodaj u katalog'}
          loading={loading}
          onPress={() => onConfirm(confirmed)}
        />
      ) : null}
      <View style={styles.cancelButton}>
        <PrimaryButton label="Natrag" onPress={onCancel} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 20,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    marginTop: 8,
  },
  author: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 5,
  },
  notice: {
    backgroundColor: colors.fill,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  protectedBox: {
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    padding: 14,
    marginVertical: 18,
  },
  protectedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  protectedText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  warning: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  checkmark: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  confirmText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  cancelButton: {
    marginTop: 10,
  },
});
