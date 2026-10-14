import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { displayName } from '@/src/components/PartyContact';
import { ActionModal, ActionModalConfig } from '@/src/components/ActionModal';
import { colors } from '@/src/theme/colors';
import { formatShortDateTime } from '@/src/services/dates';
import { getParkingSpotById, getUserDetail, listReports, resolveReport } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { ReportStatus, UserReport } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

const TABS: { value: ReportStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'RESOLVED', label: 'Resueltas' },
  { value: 'DISMISSED', label: 'Descartadas' },
];

const TARGET_TEXT: Record<UserReport['targetType'], string> = { spot: 'Cochera', user: 'Usuario', review: 'Reseña' };

// "Denuncias" -- what users reported from the app (a spot, a person, a review). Each one
// links to what was reported, where the action happens (suspend the spot or the account,
// hide the review); here it's then closed as resolved or dismissed, with a note.
export default function Reports() {
  const [tab, setTab] = useState<ReportStatus>('PENDING');
  const [reports, setReports] = useState<UserReport[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionModalConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listReports(tab);
      setReports(rows);
      const userIds = [...new Set(rows.flatMap((r) => (r.targetType === 'user' ? [r.reporterId, r.targetId] : [r.reporterId])))];
      const spotIds = [...new Set(rows.filter((r) => r.targetType === 'spot').map((r) => r.targetId))];
      const [userResults, spotResults] = await Promise.all([
        Promise.allSettled(userIds.map((id) => getUserDetail(id))),
        Promise.allSettled(spotIds.map((id) => getParkingSpotById(id))),
      ]);
      const loaded: Record<string, string> = {};
      userResults.forEach((r, i) => r.status === 'fulfilled' && (loaded[userIds[i]] = displayName(r.value)));
      spotResults.forEach((r, i) => r.status === 'fulfilled' && (loaded[spotIds[i]] = r.value.title));
      setNames(loaded);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las denuncias.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  function openTarget(report: UserReport) {
    if (report.targetType === 'spot') router.push(`/(admin)/spots/${report.targetId}` as never);
    else if (report.targetType === 'user') router.push(`/(admin)/users/${report.targetId}` as never);
    else router.push('/(admin)/reviews' as never);
  }

  function close(report: UserReport, status: 'RESOLVED' | 'DISMISSED') {
    setAction({
      title: status === 'RESOLVED' ? 'Marcar como resuelta' : 'Descartar la denuncia',
      description:
        status === 'RESOLVED'
          ? 'Contá qué se hizo (por ejemplo: se suspendió la cochera, se ocultó la reseña).'
          : 'No hay nada que hacer con esta denuncia.',
      confirmLabel: status === 'RESOLVED' ? 'Resolver' : 'Descartar',
      noteOptional: status === 'DISMISSED',
      onConfirm: async (note) => {
        await resolveReport(report.id, status, note);
        await load();
      },
    });
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Denuncias" subtitle="Lo que los usuarios denunciaron desde la app. Abrí lo denunciado para actuar y después cerrá la denuncia." />
        <View style={styles.chips}>
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Pressable
                key={t.value}
                onPress={() => setTab(t.value)}
                style={({ hovered }: PressableState) => [styles.chip, active && styles.chipActive, hovered && !active && styles.hovered, CURSOR_POINTER]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? <ActivityIndicator color={colors.teal} /> : (
              <Text style={styles.meta}>{tab === 'PENDING' ? 'No hay denuncias pendientes.' : 'No hay denuncias acá.'}</Text>
            )
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.header}>
                <Badge label={TARGET_TEXT[item.targetType].toUpperCase()} color={colors.deepNavy} />
                <Text style={styles.reason}>{item.reason}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.meta}>{formatShortDateTime(item.createdAt)}</Text>
              </View>
              {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
              <Text style={styles.meta}>
                Denunciado: {names[item.targetId] ?? item.targetId.slice(0, 8)} · por {names[item.reporterId] ?? 'usuario'}
              </Text>
              {item.adminNote ? <Text style={styles.meta}>Nota: {item.adminNote}</Text> : null}
              <View style={styles.actions}>
                <Pressable onPress={() => openTarget(item)} style={CURSOR_POINTER}>
                  <Text style={styles.link}>Ver {TARGET_TEXT[item.targetType].toLowerCase()}</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                {item.status === 'PENDING' ? (
                  <>
                    <Button title="Descartar" variant="secondary" onPress={() => close(item, 'DISMISSED')} />
                    <Button title="Resolver" onPress={() => close(item, 'RESOLVED')} />
                  </>
                ) : null}
              </View>
            </Card>
          )}
        />
      </View>
      <ActionModal config={action} onClose={() => setAction(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, gap: 12, maxWidth: 900, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hovered: { backgroundColor: colors.background },
  error: { color: colors.danger, fontSize: 14 },
  meta: { fontSize: 12, color: colors.textSecondary },
  list: { gap: 10, paddingBottom: 12 },
  card: { gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  reason: { fontSize: 15, fontWeight: '700', color: colors.text },
  details: { fontSize: 14, color: colors.text, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  link: { fontSize: 13, fontWeight: '700', color: colors.teal },
});
