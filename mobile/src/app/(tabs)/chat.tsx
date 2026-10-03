import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatCards } from '@/components/chat-cards';
import { LanguagePicker, nativeName } from '@/components/language-picker';
import { OrbitScene } from '@/components/scenes';
import { FullScreenLoader } from '@/components/travel-loader';
import { Chip, FadeIn, Icon, pageWidth } from '@/components/ui';
import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useCurrentOrigin } from '@/lib/location';
import { useApp } from '@/lib/app-context';
import { useT } from '@/lib/i18n';
import { MenuButton } from '@/lib/menu';
import type { Card } from '@/lib/types';
import { speak, stopSpeaking, useVoiceInput } from '@/lib/voice';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** What goes to the copilot when it differs from what's shown (e.g. a hidden trip id). */
  content?: string;
  cards?: Card[];
  offline?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  'Kothrud to Connaught Place, Delhi by 8 PM',
  'Plan an EV trip to Mahabaleshwar',
  'Chargers near Baner',
  'जवळचे पार्किंग कुठे आहे?',
];

let nextId = 1;

export default function ChatScreen() {
  const theme = useTheme();
  const t = useT();
  const { profile, setLanguage } = useApp();
  const origin = useCurrentOrigin();
  const params = useLocalSearchParams<{
    q?: string;
    n?: string;
    voice?: string;
    fix?: string;
    title?: string;
  }>();
  const language = profile?.language ?? 'en-IN';
  const sarvam = profile?.services?.speech === 'sarvam';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const handledParam = useRef<string | null>(null);

  const readAloud = useCallback(
    (m: Message) => {
      setSpeakingId(m.id);
      speak(m.text, language, sarvam).finally(() => setSpeakingId(null));
    },
    [language, sarvam],
  );

  const send = useCallback(
    async (text: string, opts: { speakReply?: boolean; content?: string } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput('');
      setHint(null);
      const userMsg: Message = { id: nextId++, role: 'user', text: trimmed, content: opts.content };
      const history = [...messages.filter((m) => !m.error), userMsg];
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);
      try {
        const res = await api.chat(
          history.map((m) => ({ role: m.role, content: m.content ?? m.text })),
          language,
          // Lets the copilot plan from where the user is when they don't name a start.
          origin ? { lat: origin.lat, lng: origin.lng } : undefined,
        );
        const reply: Message = {
          id: nextId++,
          role: 'assistant',
          text: res.reply,
          cards: res.cards,
          offline: res.mode === 'offline',
        };
        setMessages((prev) => [...prev, reply]);
        // Voice in, voice out.
        if (opts.speakReply) readAloud(reply);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { id: nextId++, role: 'assistant', text: (e as Error).message, error: true },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, language, origin, readAloud],
  );

  const voice = useVoiceInput(
    useCallback((text: string) => send(text, { speakReply: true }), [send]),
    language,
  );

  // A query handed over from Home (or "Fix my trip") arrives as ?q=...&n=<nonce>.
  useEffect(() => {
    const key = params.q ? `${params.q}|${params.n ?? ''}` : null;
    if (key && handledParam.current !== key) {
      handledParam.current = key;
      send(params.q!);
    }
  }, [params.q, params.n, send]);

  // "Fix my trip" from an alert banner.
  useEffect(() => {
    const key = params.fix ? `${params.fix}|${params.n ?? ''}` : null;
    if (key && handledParam.current !== key) {
      handledParam.current = key;
      send(`Fix my trip: ${params.title ?? 'my disrupted trip'}`, {
        content: `My trip "${params.title ?? ''}" is disrupted. Fix my trip (trip id: ${params.fix}). Explain the impact in one sentence and give me the best new plan.`,
      });
    }
  }, [params.fix, params.title, params.n, send]);

  // The mic on Home lands here and starts listening straight away.
  const handledVoice = useRef<string | null>(null);
  useEffect(() => {
    if (params.voice && handledVoice.current !== params.voice) {
      handledVoice.current = params.voice;
      if (sarvam && voice.state === 'idle') voice.start();
    }
  }, [params.voice, sarvam, voice]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, busy]);

  useEffect(() => () => stopSpeaking(), []);

  function onMic() {
    if (!sarvam) {
      setHint(
        'Voice input needs the Sarvam key on the server. Tap the mic on your keyboard to dictate instead.',
      );
      return;
    }
    if (voice.state === 'recording') voice.stop();
    else if (voice.state === 'idle') voice.start();
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.page }]}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <Icon name="robot-happy-outline" color={theme.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>SafarSathi</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{t('chat.subtitle')}</Text>
        </View>
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Language: ${nativeName(language)}. Change language`}
          style={[
            styles.langButton,
            { borderColor: theme.accent, backgroundColor: theme.accentSoft },
          ]}>
          <Icon name="translate" size={18} color={theme.accent} />
          <Text style={[styles.langText, { color: theme.text }]}>{nativeName(language)}</Text>
        </Pressable>
        <MenuButton />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        // Android is edge-to-edge (the window doesn't resize), so pad on both platforms.
        behavior="padding">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.messages, pageWidth(820)]}
          keyboardShouldPersistTaps="handled">
          {messages.length === 0 && (
            <View style={styles.welcome}>
              <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                Namaste{profile ? `, ${profile.name}` : ''}! {t('chat.welcome')}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{t('chat.intro')}</Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} onPress={() => send(s)} />
                ))}
              </View>
            </View>
          )}

          {messages.map((m) => (
            <FadeIn key={m.id} style={m.role === 'user' ? styles.userRow : styles.botRow}>
              <View
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? { backgroundColor: theme.accent, borderBottomRightRadius: 4 }
                    : {
                        backgroundColor: m.error ? theme.dangerSoft : theme.surface,
                        borderColor: theme.border,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderBottomLeftRadius: 4,
                      },
                ]}>
                <Text
                  style={[
                    styles.bubbleText,
                    {
                      color:
                        m.role === 'user' ? theme.onAccent : m.error ? theme.danger : theme.text,
                    },
                  ]}>
                  {m.text}
                </Text>
                {m.role === 'assistant' && !m.error && (
                  <View style={styles.bubbleFooter}>
                    {m.offline && (
                      <Text style={[styles.tag, { color: theme.textSecondary }]}>
                        {t('chat.offline')}
                      </Text>
                    )}
                    <Pressable
                      onPress={() =>
                        speakingId === m.id ? (stopSpeaking(), setSpeakingId(null)) : readAloud(m)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={speakingId === m.id ? 'Stop reading' : 'Read aloud'}
                      hitSlop={12}
                      style={styles.speaker}>
                      <Icon
                        name={speakingId === m.id ? 'stop-circle-outline' : 'volume-high'}
                        size={20}
                        color={theme.accent}
                      />
                    </Pressable>
                  </View>
                )}
              </View>
              {m.cards && <ChatCards cards={m.cards} />}
            </FadeIn>
          ))}
        </ScrollView>
        <Thinking visible={busy} />

        {(hint || voice.error) && (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{voice.error ?? hint}</Text>
        )}

        <View
          style={[
            styles.inputBar,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pageWidth(820),
            Platform.OS === 'web' && styles.inputBarWeb,
          ]}>
          <Pressable
            onPress={onMic}
            accessibilityRole="button"
            accessibilityLabel={voice.state === 'recording' ? 'Stop recording' : 'Speak'}
            style={[
              styles.roundButton,
              { backgroundColor: voice.state === 'recording' ? theme.danger : theme.surfaceAlt },
            ]}>
            {voice.state === 'transcribing' ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Icon
                name={voice.state === 'recording' ? 'stop' : 'microphone'}
                size={24}
                color={voice.state === 'recording' ? '#FFFFFF' : theme.accent}
              />
            )}
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={voice.state === 'recording' ? t('chat.listening') : t('chat.placeholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            multiline
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[
              styles.roundButton,
              { backgroundColor: theme.accent, opacity: !input.trim() || busy ? 0.4 : 1 },
            ]}>
            <Icon name="send" size={22} color={theme.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <LanguagePicker
        visible={pickerOpen}
        value={language}
        onSelect={setLanguage}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Full-screen travel scene over the messages while the copilot works. */
function Thinking({ visible }: { visible: boolean }) {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [visible]);
  return (
    <FullScreenLoader
      visible={visible}
      scene={<OrbitScene />}
      title={t('chat.planning')}
      subtitle={slow ? t('chat.checking') : undefined}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
  langButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  langText: { fontSize: 15, fontWeight: '700' },
  messages: { padding: Spacing.md, gap: Spacing.md },
  welcome: { gap: Spacing.sm, marginTop: Spacing.lg },
  welcomeTitle: { fontSize: 24, fontWeight: '800' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  userRow: { alignItems: 'flex-end' },
  botRow: { alignItems: 'stretch' },
  bubble: { maxWidth: '88%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 16, lineHeight: 23 },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  tag: { fontSize: 11, fontWeight: '600' },
  speaker: { padding: 2 },
  hint: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs, fontSize: 13 },
  // Website: a floating rounded bar rather than a full-width strip.
  inputBarWeb: { borderWidth: 1, borderRadius: 20, marginBottom: Spacing.md },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 12, paddingHorizontal: 4 },
  roundButton: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: TouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
