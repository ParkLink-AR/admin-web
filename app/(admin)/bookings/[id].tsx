import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { BookingStatusBadge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { PartyContact, displayName } from '@/src/components/PartyContact';
import { ActionModal, ActionModalConfig } from '@/src/components/ActionModal';
import { PendingVerificationDecision, VerificationDecisionModal } from '@/src/components/VerificationDecisionModal';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { formatShortDateTime } from '@/src/services/dates';
import { CANCELLATION_TEXT } from '@/src/services/labels';
import {
  adminCancelBooking, adminRefundBooking, getAdminBooking, getBookingChat, getParkingSpotById, getUserDetail,
} from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminBooking, AdminUserDetail, BookingChatMessage, ParkingSpot } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

// Statuses a booking can still be cancelled from (it holds its slot).
const CANCELLABLE = new Set(['PENDING_PAYMENT', 'PENDING_OWNER_APPROVAL', 'CONFIRMED', 'IN_PROGRESS']);
// A finished (or running) paid booking is refunded instead.
const REFUNDABLE = new Set(['COMPLETED', 'IN_PROGRESS']);

// One booking, loaded by its id from anywhere in the panel (search, a user, a ticket, a
// payment...): what was booked and paid, both people, its chat, and what staff can do --
// decide an unverified one, cancel it, or refund part of it.
export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<AdminBooking | null>(null);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [driver, setDriver] = useState<AdminUserDetail | null>(null);
  const [owner, setOwner] = useState<AdminUserDetail | null>(null);
  const [chat, setChat] = useState<BookingChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<ActionModalConfig | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingVerificationDecision | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const loaded = await getAdminBooking(id);
      setBooking(loaded);
      const [spotResult, driverResult, chatResult] = await Promise.allSettled([
        getParkingSpotById(loaded.parkingSpotId),
        getUserDetail(loaded.userId),
        getBookingChat(loaded.id),
      ]);
      if (driverResult.status === 'fulfilled') setDriver(driverResult.value);
      setChat(chatResult.status === 'fulfilled' ? chatResult.value : []);
      if (spotResult.status === 'fulfilled') {
        setSpot(spotResult.value);
        try {
          setOwner(await getUserDetail(spotResult.value.ownerId));
        } catch {
          // No owner contact if this fails -- not fatal to the rest of the page.
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo cargar la reserva.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Screen style={styles.screen} edges={['left', 'right']}>
        <View style={styles.body}>
          <PageHeader title="Detalle de reserva" showBack />
          <Text style={styles.error}>{error}</Text>
        </View>
      </Screen>
    );
  }
  if (!booking) {
    return (
      <Screen style={styles.screen} edges={['left', 'right']}>
        <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const paid = !!booking.paidAt;
  const refundable = booking.amount - booking.refundedAmount;
  const canCancel = CANCELLABLE.has(booking.status);
  const canRefund = paid && REFUNDABLE.has(booking.status) && refundable > 0;
  const awaitingReview = booking.verificationReview === 'PENDING';

  function openCancel() {
    if (!booking) return;
    setAction({
      title: 'Cancelar la reserva',
      description: paid
        ? 'La reserva se cancela y el horario queda libre. Elegí cuánto se le devuelve al conductor (por defecto, todo lo que pagó). A los dos les llega un aviso.'
        : 'La reserva no está pagada: se cancela sin reembolso y el horario queda libre.',
      confirmLabel: 'Cancelar reserva',
      variant: 'danger',
      amount: paid ? { label: 'Reembolso al conductor ($)', max: booking.amount / 100, defaultAmount: booking.amount / 100 } : undefined,
      onConfirm: async (note, amountPesos) => {
        const updated = await adminCancelBooking(
          booking.id, note, amountPesos === null ? undefined : Math.round(amountPesos * 100),
        );
        setBooking(updated);
        setNotice(
          updated.refundedAmount > 0
            ? `Reserva cancelada. Se le devuelven ${formatCentavos(updated.refundedAmount)} al conductor.`
            : 'Reserva cancelada.',
        );
      },
    });
  }

  function openRefund() {
    if (!booking) return;
    setAction({
      title: 'Reembolsar al conductor',
      description:
        'Se le devuelve esa parte de lo que pagó. El cobro del propietario por esta reserva baja en la misma proporción; si ya se le pagó, el reembolso lo absorbe ParkLink.',
      confirmLabel: 'Reembolsar',
      variant: 'danger',
      amount: { label: 'Monto a devolver ($)', max: refundable / 100, defaultAmount: refundable / 100 },
      onConfirm: async (note, amountPesos) => {
        const { booking: updated, absorbedByParkLink } = await adminRefundBooking(
          booking.id, Math.round((amountPesos ?? 0) * 100), note,
        );
        setBooking(updated);
        setNotice(
          absorbedByParkLink
            ? 'Reembolso hecho. Al propietario ya se le había pagado: este reembolso lo absorbe ParkLink.'
            : 'Reembolso hecho. El cobro del propietario por esta reserva se ajustó.',
        );
      },
    });
  }

  function senderName(senderId: string) {
    if (senderId === booking?.userId) return driver ? `${displayName(driver)} (conductor)` : 'Conductor';
    if (senderId === spot?.ownerId) return owner ? `${displayName(owner)} (propietario)` : 'Propietario';
    return 'Usuario';
  }

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title="Detalle de reserva" showBack />

        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <Card>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {formatShortDateTime(booking.start)} → {formatShortDateTime(booking.end)}
            </Text>
            <BookingStatusBadge status={booking.status} />
          </View>
          <Text style={styles.caption}>ID: {booking.id}</Text>
          <DataRow label="Tipo" value={booking.kind === 'HOURLY' ? 'Por hora' : 'Estadía'} />
          <DataRow label="Pagó el conductor" value={formatCentavos(booking.amount)} />
          {booking.ownerAmount !== null ? <DataRow label="Le corresponde al propietario" value={formatCentavos(booking.ownerAmount)} /> : null}
          {booking.refundedAmount > 0 ? <DataRow label="Reembolsado por ParkLink" value={formatCentavos(booking.refundedAmount)} /> : null}
          {booking.vehiclePlate ? (
            <DataRow
              label="Vehículo"
              value={[booking.vehicleBrand, booking.vehicleModel, booking.vehiclePlate].filter(Boolean).join(' · ')}
            />
          ) : null}
          {booking.paymentId ? <DataRow label="Pago (Mercado Pago)" value={booking.paymentId} /> : null}
          {booking.paidAt ? <DataRow label="Pagado" value={formatShortDateTime(booking.paidAt)} /> : null}
          {booking.verifiedAt ? <DataRow label="Llegada verificada" value={formatShortDateTime(booking.verifiedAt)} /> : null}
          {booking.cancellationReason ? (
            <DataRow label="Motivo de cancelación" value={CANCELLATION_TEXT[booking.cancellationReason] ?? booking.cancellationReason} />
          ) : null}
          {booking.adminNote ? <DataRow label="Nota de ParkLink" value={booking.adminNote} /> : null}
          <DataRow label="Creada" value={formatShortDateTime(booking.createdAt)} />
        </Card>

        {canCancel || canRefund || awaitingReview ? (
          <Card style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Acciones</Text>
            {awaitingReview ? (
              <Text style={styles.reviewText}>
                Terminó sin que el propietario cargara el código de llegada: su cobro queda retenido hasta que decidas.
              </Text>
            ) : null}
            <View style={styles.actionsRow}>
              {awaitingReview ? (
                <>
                  <Button
                    title="Reembolsar al conductor"
                    variant="danger"
                    onPress={() => setPendingReview({ bookingId: booking.id, amount: booking.amount, decision: 'REFUNDED' })}
                  />
                  <Button
                    title="Aprobar pago al dueño"
                    onPress={() => setPendingReview({ bookingId: booking.id, amount: booking.amount, decision: 'APPROVED' })}
                  />
                </>
              ) : null}
              {canCancel ? <Button title="Cancelar reserva" variant="danger" onPress={openCancel} /> : null}
              {canRefund && !awaitingReview ? <Button title="Reembolsar" variant="secondary" onPress={openRefund} /> : null}
            </View>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Cochera</Text>
          {spot ? (
            <Pressable
              onPress={() => router.push(`/(admin)/spots/${spot.id}`)}
              style={({ hovered }: PressableState) => [styles.linkRow, hovered && styles.linkRowHovered, CURSOR_POINTER]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{spot.title}</Text>
                <Text style={styles.caption}>{spot.address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Text style={styles.hint}>No se pudo cargar la cochera (ID: {booking.parkingSpotId}).</Text>
          )}
        </Card>

        <View style={styles.partiesRow}>
          <Card style={styles.partyCard}>
            <PartyContact label="Conductor" user={driver} fallbackId={booking.userId} />
          </Card>
          <Card style={styles.partyCard}>
            <PartyContact label="Propietario" user={owner} fallbackId={spot?.ownerId} />
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Chat entre conductor y propietario</Text>
          <Text style={styles.hint}>Solo lectura: lo que se escribieron desde la app sobre esta reserva.</Text>
          {chat === null ? (
            <ActivityIndicator color={colors.teal} style={{ marginTop: 10 }} />
          ) : chat.length === 0 ? (
            <Text style={[styles.hint, { marginTop: 10 }]}>No se escribieron mensajes.</Text>
          ) : (
            <View style={styles.chat}>
              {chat.map((m) => {
                const fromDriver = m.senderId === booking.userId;
                return (
                  <View key={m.id} style={[styles.bubbleRow, fromDriver ? styles.bubbleLeft : styles.bubbleRight]}>
                    <View style={[styles.bubble, fromDriver ? styles.bubbleDriver : styles.bubbleOwner]}>
                      <Text style={styles.bubbleAuthor}>{senderName(m.senderId)}</Text>
                      <Text style={styles.bubbleText}>{m.body}</Text>
                      <Text style={styles.bubbleTime}>{formatShortDateTime(m.createdAt)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>

      <ActionModal config={action} onClose={() => setAction(null)} />
      <VerificationDecisionModal
        pending={pendingReview}
        onClose={() => setPendingReview(null)}
        onResolved={() => {
          setPendingReview(null);
          setNotice('Decisión guardada.');
          load();
        }}
      />
    </Screen>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' },
  error: { color: colors.danger, fontSize: 14 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10,
    backgroundColor: colors.teal + '14', borderWidth: 1, borderColor: colors.teal + '40',
  },
  noticeText: { flex: 1, fontSize: 14, color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  caption: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 4 },
  dataLabel: { fontSize: 13, color: colors.textSecondary },
  dataValue: { fontSize: 13, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  hint: { fontSize: 13, color: colors.textSecondary },
  actionsCard: { gap: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reviewText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4, borderRadius: 6 },
  linkRowHovered: { backgroundColor: colors.background },
  linkTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  partiesRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  partyCard: { flex: 1, minWidth: 260 },
  chat: { gap: 8, marginTop: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleDriver: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  bubbleOwner: { backgroundColor: colors.teal + '18' },
  bubbleAuthor: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  bubbleTime: { fontSize: 11, color: colors.textSecondary },
});
