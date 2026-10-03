/**
 * The ☰ menu (account sheet) lives at app level, so every tab can open it and its shortcuts,
 * including Home, always lead somewhere.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { AccountSheet } from '@/components/account-sheet';
import { LanguagePicker } from '@/components/language-picker';
import { WIDE_CHROME } from '@/components/web-chrome';
import { Icon, isHovered, webInteractive } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useApp } from '@/lib/app-context';

const MenuContext = createContext<{ openMenu: () => void; openLanguage: () => void } | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const { profile, setLanguage } = useApp();
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const openMenu = useCallback(() => setOpen(true), []);
  const openLanguage = useCallback(() => setLanguageOpen(true), []);
  return (
    <MenuContext.Provider value={{ openMenu, openLanguage }}>
      {children}
      <AccountSheet
        visible={open}
        onClose={() => setOpen(false)}
        onChangeLanguage={() => setLanguageOpen(true)}
      />
      <LanguagePicker
        visible={languageOpen}
        value={profile?.language ?? 'en-IN'}
        onSelect={setLanguage}
        onClose={() => setLanguageOpen(false)}
      />
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('useMenu must be used inside <MenuProvider>');
  return ctx;
}

/** The ☰ button shown in each tab's header. */
export function MenuButton() {
  const theme = useTheme();
  const { openMenu } = useMenu();
  const width = useWindowDimensions().width;
  const chrome = Platform.OS === 'web' && width >= WIDE_CHROME;
  if (chrome) return null; // the website's right dock has the menu
  return (
    <Pressable
      onPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel="Menu"
      hitSlop={8}
      style={(state) => [
        styles.button,
        webInteractive,
        { backgroundColor: theme.surface, borderColor: theme.border },
        isHovered(state) && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
      ]}>
      <Icon name="menu" size={24} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
