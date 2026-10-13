import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { BookingStatusBadge, TicketStatusBadge } from '@/src/components/Badge';
import { PartyContact, displayName } from '@/src/components/PartyContact';
import { colors } from '@/src/theme/colors';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';
import { formatCentavos } from '@/src/services/money';
import { formatShortDateTime } from '@/src/services/dates';
import {
  getSupportTicket, getUserDetail, listSupportTicketMessages, replySupportTicket, updateSupportTicketStatus,
} from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminUserDetail, SupportTicketDetail, SupportTicketMessage, TicketStatus } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

// While the page is open, the conversation refreshes on its own so a user's new message
// shows up without reloading.
const REFRESH_MS = 15_000;

// One support ticket: its conversation with the user, a reply box, the status actions, and
// the booking it's about with both people's contact -- everything to answer it from here.
export default function SupportTicketPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDesktop = useIsDesktop();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUserDetail>>({});
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [changing, setChanging] = useState<TicketStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      setMessages(await listSupportTicketMessages(id));
    } catch {
      // Kept as it was; the next refresh tries again.
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [detail, thread] = await Promise.all([getSupportTicket(id), listSupportTicketMessages(id)]);
      setTicket(detail);
      setMessages(thread);
      const ids = [...new Set([detail.driverId, detail.ownerId])];
      const results = await Promise.allSettled(ids.map((userId) => getUserDetail(userId)));
      const loaded: Record<string, AdminUserDetail> = {};
      results.forEach((r, i) => r.status === 'fulfilled' && (loaded[ids[i]] = r.value));
      setUsers(loaded);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el ticket.');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(loadMessages, REFRESH_MS);
      return () => clearInterval(timer);
    }, [load, loadMessages])
  );

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !ticket || sending) return;
    setSending(true);
    setActionError(null);
    try {
      const created = await replySupportTicket(ticket.id, body);
      setMessages((prev) => [...prev, created]);
      setDraft('');
      // Replying to an open ticket moves it to "en curso" on the server.
      if (ticket.status === 'OPEN') setTicket({ ...ticket, status: 'IN_PROGRESS' });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : 'No se pudo enviar la respuesta.');
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!ticket) return;
    setChanging(status);
    setActionError(null);
    try {
      await updateSupportTicketStatus(ticket.id, status);
      setTicket({ ...ticket, status });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : 'No se pudo cambiar el estado.');
    } finally {
      setChanging(null);
    }
  }

  function openBooking() {
    if (!ticket) return;
    router.push({
      pathname: '/(admin)/bookings/[id]',
      params: {
        id: ticket.bookingId,
        parkingSpotId: ticket.parkingSpotId,
        userId: ticket.driverId,
        start: ticket.bookingStart,
        end: ticket.bookingEnd,
        status: ticket.bookingStatus,
        amount: String(ticket.bookingAmount), // centavos, like every caller of this page
        paymentId: ticket.paymentId ?? '',
        paidAt: '',
        cancellationReason: '',
        kind: ticket.bookingKind,
        updatedAt: '',
      },
    });
  }

  if (error) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.body}>
          <PageHeader title="Ticket" showBack />
          <Text style={styles.error}>{error}</Text>
        </View>
      </Screen>
    );
  }
  if (!ticket) {
    return (
      <Screen style={styles.screen}>
        <ActivityIndicator color={colors.teal} style={styles.spinner} />
      </Screen>
    );
  }

  const creatorId = ticket.creatorRole === 'driver' ? ticket.driverId : ticket.ownerId;
  const creator = users[creatorId];
  const creatorName = creator ? displayName(creator) : 'Usuario';
  const closed = ticket.status === 'CLOSED';

  const conversation = (
    <Card style={styles.chatCard}>
      <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.isAdmin ? styles.bubbleRowStaff : styles.bubbleRowUser]}>
            <View style={[styles.bubble, m.isAdmin ? styles.bubbleStaff : styles.bubbleUser]}>
              <Text style={[styles.bubbleAuthor, m.isAdmin && styles.bubbleTextStaff]}>
                {m.isAdmin ? 'ParkLink' : creatorName}
              </Text>
              <Text style={[styles.bubbleText, m.isAdmin && styles.bubbleTextStaff]}>{m.body}</Text>
              <Text style={[styles.bubbleTime, m.isAdmin && styles.bubbleTimeStaff]}>{formatShortDateTime(m.createdAt)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {closed ? (
        <Text style={styles.closedNote}>El ticket está cerrado: el usuario ya no puede escribir. Reabrilo para seguir la conversación.</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={`Responder a ${creatorName}…`}
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Button title="Enviar" onPress={send} loading={sending} disabled={!draft.trim()} />
        </View>
      )}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
    </Card>
  );

  const side = (
    <View style={styles.side}>
      <Card style={styles.sideCard}>
        <Text style={styles.sectionLabel}>ESTADO</Text>
        <TicketStatusBadge status={ticket.status} />
        <View style={styles.actions}>
          {ticket.status === 'OPEN' ? (
            <Button title="Tomar" variant="secondary" onPress={() => changeStatus('IN_PROGRESS')} loading={changing === 'IN_PROGRESS'} />
          ) : null}
          {ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' ? (
            <Button title="Marcar resuelto" onPress={() => changeStatus('RESOLVED')} loading={changing === 'RESOLVED'} />
          ) : null}
          {!closed ? (
            <Button title="Cerrar" variant="secondary" onPress={() => changeStatus('CLOSED')} loading={changing === 'CLOSED'} />
          ) : null}
          {ticket.status === 'RESOLVED' || closed ? (
            <Button title="Reabrir" variant="secondary" onPress={() => changeStatus('OPEN')} loading={changing === 'OPEN'} />
          ) : null}
        </View>
        <Text style={styles.hint}>
          Al marcarlo resuelto o cerrarlo, le avisamos al usuario. Si escribe en un ticket resuelto, se reabre solo.
        </Text>
      </Card>

      <Card style={styles.sideCard}>
        <Text style={styles.sectionLabel}>RESERVA</Text>
        <Pressable
          onPress={() => router.push(`/(admin)/spots/${ticket.parkingSpotId}` as never)}
          style={({ hovered }: PressableState) => [styles.linkRow, hovered && styles.hovered, CURSOR_POINTER]}
        >
          <Text style={styles.spotTitle} numberOfLines={2}>{ticket.parkingSpotTitle || 'Cochera'}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.teal} />
        </Pressable>
        <Text style={styles.caption}>
          {formatShortDateTime(ticket.bookingStart)} → {formatShortDateTime(ticket.bookingEnd)}
        </Text>
        <Text style={styles.caption}>
          {ticket.bookingKind === 'STAY' ? 'Estadía' : 'Por hora'} · {formatCentavos(ticket.bookingAmount)}
        </Text>
        <BookingStatusBadge status={ticket.bookingStatus} />
        <Pressable onPress={openBooking} style={({ hovered }: PressableState) => [styles.linkRow, hovered && styles.hovered, CURSOR_POINTER]}>
          <Text style={styles.link}>Ver la reserva</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.teal} />
        </Pressable>
      </Card>

      <Card style={styles.sideCard}>
        <PartyContact
          label={ticket.creatorRole === 'driver' ? 'Conductor (abrió el ticket)' : 'Conductor'}
          user={users[ticket.driverId] ?? null}
          fallbackId={ticket.driverId}
        />
        <View style={styles.divider} />
        <PartyContact
          label={ticket.creatorRole === 'owner' ? 'Propietario (abrió el ticket)' : 'Propietario'}
          user={users[ticket.ownerId] ?? null}
          fallbackId={ticket.ownerId}
        />
      </Card>
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader
          title={ticket.subject}
          subtitle={`Abierto por ${creatorName} (${ticket.creatorRole === 'driver' ? 'conductor' : 'propietario'}) el ${formatShortDateTime(ticket.createdAt)}`}
          showBack
        />
        <View style={isDesktop ? styles.columns : styles.stack}>
          <View style={isDesktop ? styles.mainColumn : undefined}>{conversation}</View>
          {side}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  spinner: { marginTop: 40 },
  error: { color: colors.danger, fontSize: 14 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  stack: { gap: 16 },
  mainColumn: { flex: 1, minWidth: 0 },
  chatCard: { gap: 12 },
  thread: { maxHeight: 520 },
  threadContent: { gap: 10, paddingVertical: 4 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowStaff: { justifyContent: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 3 },
  bubbleStaff: { backgroundColor: colors.teal, borderBottomRightRadius: 4 },
  bubbleUser: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleAuthor: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  bubbleText: { fontSize: 14, lineHeight: 20, color: colors.text },
  bubbleTextStaff: { color: colors.white },
  bubbleTime: { fontSize: 11, color: colors.textSecondary },
  bubbleTimeStaff: { color: 'rgba(255,255,255,0.75)', textAlign: 'right' },
  composer: { gap: 10 },
  input: {
    minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, textAlignVertical: 'top',
  },
  closedNote: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  side: { width: 320, maxWidth: '100%', gap: 16 },
  sideCard: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8 },
  actions: { gap: 8, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, alignSelf: 'flex-start' },
  hovered: { backgroundColor: colors.background },
  spotTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  caption: { fontSize: 13, color: colors.textSecondary },
  link: { fontSize: 13, fontWeight: '700', color: colors.teal },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
