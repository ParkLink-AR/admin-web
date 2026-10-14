import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { ActionModal, ActionModalConfig } from '@/src/components/ActionModal';
import { colors } from '@/src/theme/colors';
import { formatShortDateTime } from '@/src/services/dates';
import { listBroadcasts, sendBroadcast } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { Broadcast, BroadcastAudience } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'drivers', label: 'Conductores' },
  { value: 'owners', label: 'Propietarios' },
];
const AUDIENCE_TEXT: Record<BroadcastAudience, string> = { all: 'Todos', drivers: 'Conductores', owners: 'Propietarios' };
const TITLE_MAX = 120;
const BODY_MAX = 1000;

// "Avisos" -- an announcement to every active user in an audience (news, maintenance,
// promotions): each one gets it in the app's notifications and as a push. Below, what was
// already sent.
export default function Broadcasts() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [history, setHistory] = useState<Broadcast[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionModalConfig | null>(null);

  const load = useCallback(async () => {
    try {
      setHistory(await listBroadcasts());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el historial.');
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ready = title.trim().length > 0 && body.trim().length > 0;

  function confirmSend() {
    setNotice(null);
    setAction({
      title: 'Mandar el aviso',
      description: `Le va a llegar a ${AUDIENCE_TEXT[audience].toLowerCase()} como notificación en la app y como push. No se puede deshacer.`,
      confirmLabel: 'Mandar',
      noteOptional: true,
      notePlaceholder: 'Nota interna (opcional)',
      onConfirm: async () => {
        const sent = await sendBroadcast(title.trim(), body.trim(), audience);
        setNotice(`Aviso enviado a ${sent.recipients} ${sent.recipients === 1 ? 'usuario' : 'usuarios'}.`);
        setTitle('');
        setBody('');
        await load();
      },
    });
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title="Avisos" subtitle="Mandá un aviso a todos los usuarios, o solo a conductores o propietarios. Les llega como notificación en la app y como push." />

        <Card style={styles.form}>
          <Text style={styles.label}>Para</Text>
          <View style={styles.chips}>
            {AUDIENCES.map((a) => {
              const active = a.value === audience;
              return (
                <Pressable
                  key={a.value}
                  onPress={() => setAudience(a.value)}
                  style={({ hovered }: PressableState) => [styles.chip, active && styles.chipActive, hovered && !active && styles.hovered, CURSOR_POINTER]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
            placeholder="Ej.: Mantenimiento programado"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Mensaje</Text>
          <TextInput
            style={[styles.input, styles.bodyInput]}
            value={body}
            onChangeText={(t) => setBody(t.slice(0, BODY_MAX))}
            multiline
            placeholder="Lo que les querés contar"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.counter}>{body.length}/{BODY_MAX}</Text>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button title="Mandar aviso" onPress={confirmSend} disabled={!ready} />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Avisos enviados</Text>
        {history === null ? (
          <ActivityIndicator color={colors.teal} />
        ) : history.length === 0 ? (
          <Text style={styles.meta}>Todavía no se mandó ningún aviso.</Text>
        ) : (
          history.map((b) => (
            <Card key={b.id} style={styles.sent}>
              <View style={styles.sentHeader}>
                <Text style={styles.sentTitle}>{b.title}</Text>
                <Text style={styles.meta}>{formatShortDateTime(b.createdAt)}</Text>
              </View>
              <Text style={styles.sentBody}>{b.body}</Text>
              <Text style={styles.meta}>{AUDIENCE_TEXT[b.audience]} · {b.recipients} {b.recipients === 1 ? 'usuario' : 'usuarios'}</Text>
            </Card>
          ))
        )}
      </ScrollView>
      <ActionModal config={action} onClose={() => setAction(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hovered: { backgroundColor: colors.background },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text, backgroundColor: colors.background,
  },
  bodyInput: { minHeight: 110, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: colors.textSecondary, alignSelf: 'flex-end' },
  notice: { fontSize: 14, color: colors.teal, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
  meta: { fontSize: 12, color: colors.textSecondary },
  sent: { gap: 4 },
  sentHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  sentTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  sentBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
