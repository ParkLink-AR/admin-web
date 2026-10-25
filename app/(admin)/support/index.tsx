import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { TicketStatusBadge } from '@/src/components/Badge';
import { displayName } from '@/src/components/PartyContact';
import { colors } from '@/src/theme/colors';
import { formatShortDate, formatShortDateTime } from '@/src/services/dates';
import { getParkingSpotById, getUserDetail, listSupportTickets } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminUserDetail, ParkingSpot, SupportTicketSummary, TicketStatus } from '@/src/types';
import { bookingKindText } from '@/src/services/labels';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

type Tab = 'active' | 'resolved' | 'closed';
const TABS: { key: Tab; label: string; statuses: TicketStatus[] }[] = [
  { key: 'active', label: 'Activos', statuses: ['OPEN', 'IN_PROGRESS'] },
  { key: 'resolved', label: 'Resueltos', statuses: ['RESOLVED'] },
  { key: 'closed', label: 'Cerrados', statuses: ['CLOSED'] },
];

/** "hace 5 min", "hace 3 h", "hace 2 días" -- how long the ticket has been where it is. */
function ago(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

// The ones waiting on ParkLink first, the longest-waiting at the top; then the rest by
// latest activity.
function byUrgency(a: SupportTicketSummary, b: SupportTicketSummary): number {
  if (a.awaitingReply !== b.awaitingReply) return a.awaitingReply ? -1 : 1;
  const at = a.lastMessageAt ?? a.createdAt;
  const bt = b.lastMessageAt ?? b.createdAt;
  return a.awaitingReply ? at.localeCompare(bt) : bt.localeCompare(at);
}

// "Soporte" -- the tickets drivers and owners open from a booking in the app. Replying from
// a ticket's page sends the user a push and shows the reply in the app; ParkLink also gets an
// email at contacto@ for every new ticket or user message (notifications-service).
export default function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUserDetail>>({});
  const [spots, setSpots] = useState<Record<string, ParkingSpot>>({});
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSupportTickets();
      // Best-effort: a spot or person that fails to load just shows less.
      const spotIds = [...new Set(rows.map((t) => t.booking.parkingSpotId))];
      const userIds = [...new Set(rows.map((t) => t.createdBy))];
      const [spotResults, userResults] = await Promise.all([
        Promise.allSettled(spotIds.map((id) => getParkingSpotById(id))),
        Promise.allSettled(userIds.map((id) => getUserDetail(id))),
      ]);
      const loadedSpots: Record<string, ParkingSpot> = {};
      spotResults.forEach((r, i) => r.status === 'fulfilled' && (loadedSpots[spotIds[i]] = r.value));
      const loadedUsers: Record<string, AdminUserDetail> = {};
      userResults.forEach((r, i) => r.status === 'fulfilled' && (loadedUsers[userIds[i]] = r.value));
      setSpots(loadedSpots);
      setUsers(loadedUsers);
      setTickets(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const current = TABS.find((t) => t.key === tab)!;
  const visible = tickets.filter((t) => current.statuses.includes(t.status)).sort(byUrgency);
  const awaiting = tickets.filter((t) => t.awaitingReply).length;

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader
          title="Soporte"
          subtitle="Tickets que conductores y propietarios abren desde una reserva en la app. Arriba, los que esperan una respuesta de ParkLink."
        />

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = tickets.filter((x) => t.statuses.includes(x.status)).length;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={({ hovered }: PressableState) => [styles.tab, active && styles.tabActive, hovered && !active && styles.hovered, CURSOR_POINTER]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                <Text style={[styles.tabCount, active && styles.tabTextActive]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'active' && awaiting > 0 ? (
          <View style={styles.summary}>
            <Ionicons name="mail-unread" size={16} color={colors.warning} />
            <Text style={styles.summaryText}>
              {awaiting === 1 ? '1 ticket espera tu respuesta.' : `${awaiting} tickets esperan tu respuesta.`}
            </Text>
          </View>
        ) : null}

        {loading && tickets.length === 0 ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && visible.length === 0 ? (
          <Text style={styles.hint}>
            {tab === 'active' ? 'No hay tickets abiertos. Todo respondido.' : 'No hay tickets acá.'}
          </Text>
        ) : null}

        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const spot = spots[item.booking.parkingSpotId];
            const creator = users[item.createdBy];
            return (
              <Pressable
                onPress={() => router.push(`/(admin)/support/${item.id}` as never)}
                style={({ hovered }: PressableState) => [CURSOR_POINTER, hovered && styles.cardHovered]}
              >
                <Card style={StyleSheet.flatten([styles.card, item.awaitingReply && styles.cardAwaiting])}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>
                    <TicketStatusBadge status={item.status} />
                  </View>
                  <Text style={styles.caption}>
                    {creator ? displayName(creator) : 'Usuario'} · {item.creatorRole === 'driver' ? 'Conductor' : 'Propietario'}
                  </Text>
                  <Text style={styles.caption}>
                    {spot?.title ?? 'Cochera'} · {formatShortDate(item.booking.start)}
                    {item.booking.kind === 'STAY' ? ` → ${formatShortDate(item.booking.end)} · Estadía` : ` · ${bookingKindText(item.booking.kind)}`}
                  </Text>
                  <View style={styles.footer}>
                    {item.awaitingReply ? (
                      <View style={styles.awaitingPill}>
                        <Ionicons name="time" size={13} color={colors.warning} />
                        <Text style={styles.awaitingText}>Esperando respuesta · {ago(item.lastMessageAt)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.meta}>
                        {item.lastMessageFrom === 'staff' ? 'Respondiste' : 'Último mensaje del usuario'} {ago(item.lastMessageAt)}
                      </Text>
                    )}
                    <Text style={styles.meta}>Abierto {formatShortDateTime(item.createdAt)}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  tabCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  hovered: { backgroundColor: colors.background },
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  summaryText: { fontSize: 14, fontWeight: '600', color: '#92400E' },
  spinner: { marginTop: 24 },
  error: { color: colors.danger, fontSize: 14 },
  hint: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  list: { gap: 10, paddingBottom: 24 },
  card: { gap: 4 },
  cardAwaiting: { borderLeftWidth: 4, borderLeftColor: colors.warning },
  cardHovered: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
  subject: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  caption: { fontSize: 13, color: colors.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  awaitingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 3, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#FEF3C7',
  },
  awaitingText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  meta: { fontSize: 12, color: colors.textSecondary },
});
