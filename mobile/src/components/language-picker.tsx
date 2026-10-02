import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import type { Language } from '@/lib/types';

/** The 11 languages Sarvam can both hear and speak. Mirrors backend/src/lib/languages.ts. */
export const LANGUAGES: Language[] = [
  { code: 'en-IN', name: 'English', native: 'English' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'od-IN', name: 'Odia', native: 'ଓଡ଼ିଆ' },
];

export const nativeName = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.native ?? 'English';

export function LanguagePicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close language picker">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={() => undefined}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>Choose your language</Text>
          <Text style={{ color: theme.textSecondary }}>SafarSathi will chat and speak in it.</Text>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(l) => l.code}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: selected ? theme.accent : theme.border },
                    selected && { backgroundColor: theme.accentSoft },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.native, { color: theme.text }]}>{item.native}</Text>
                  <Text style={{ color: theme.textSecondary, flex: 1 }}>{item.name}</Text>
                  {selected && <Icon name="check-circle" color={theme.accent} />}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
    maxHeight: '80%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
  title: { fontSize: 20, fontWeight: '800' },
  list: { marginTop: Spacing.md },
  row: {
    minHeight: TouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  native: { fontSize: 18, fontWeight: '700', minWidth: 90 },
});
