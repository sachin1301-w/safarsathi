import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useT } from '@/lib/i18n';

/** Shown at the bottom of data screens: everything in the hackathon build is simulated. */
export function DemoFooter() {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={styles.footer} accessibilityRole="text">
      <Icon name="flask-outline" size={14} color={theme.muted} />
      <Text style={[styles.text, { color: theme.muted }]}>{t('common.demo')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  text: { fontSize: 12, textAlign: 'center' },
});
