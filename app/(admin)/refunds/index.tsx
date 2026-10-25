import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Modal, TextInput, TouchableWithoutFeedback, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { PartyContact } from '@/src/components/PartyContact';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { formatShortDateTime } from '@/src/services/dates';
import {
  getParkingSpotById, getUserDetail, listFailedRefunds, resolveFailedRefund, retryFailedRefund,
} from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminUserDetail, FailedRefund, ParkingSpot, RefundErrorCode, RefundResolution } from '@/src/types';
import { bookingKindText } from '@/src/services/labels';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

// What each Mercado Pago failure means, in words an admin can act on.
const ERROR_TEXT: Record<RefundErrorCode, string> = {
  test_payment: 'Es un pago de prueba de Mercado Pago: su API no permite reembolsarlo. Si es un dato de prueba, descartalo.',
  payment_not_found: 'Mercado Pago no encuentra este pago. Revisalo en el panel de Mercado Pago.',
  unauthorized: 'La cuenta de Mercado Pago no tiene permiso para reembolsar este pago.',
  transient: 'Falla pasajera de Mercado Pago (demora o caída).',
};

const CANCELLATION_TEXT: Record<string, string> = {
  OWNER_REJECTED: 'Rechazada por el propietario',
  OWNER_EXPIRED: 'El propietario no respondió a tiempo',
  DRIVER_CANCELLED: 'Cancelada por el conductor',
};

function errorText(refund: FailedRefund): string {
  return refund.errorCode ? ERROR_TEXT[refund.errorCode] : 'Mercado Pago rechazó el reembolso.';
}

function retryText(refund: FailedRefund): string {
  const attempts = `${refund.attempts} ${refund.attempts === 1 ? 'intento' : 'intentos'}`;
  if (refund.errorCode && refund.errorCode !== 'transient') return `${attempts} · reintentar no lo va a resolver`;
  return refund.retriesExhausted ? `${attempts} · ya no se reintenta solo` : `${attempts} · se reintenta solo`;
}

/** Opens the refund's booking on the booking detail page (same as the user pages do). */
function openBooking(refund: FailedRefund) {
  const b = refund.booking;
  if (!b) return;
  router.push({
    pathname: '/(admin)/bookings/[id]',
    params: {
      id: b.id,
      parkingSpotId: b.parkingSpotId,
      userId: b.userId,
      start: b.start,
      end: b.end,
      status: b.status,
      amount: String(b.amount),
      paymentId: refund.paymentId,
      paidAt: refund.approvedAt ?? '',
      cancellationReason: b.cancellationReason ? CANCELLATION_TEXT[b.cancellationReason] ?? b.cancellationReason : '',
      kind: b.kind,
      updatedAt: '',
    },
  });
}

interface PendingResolution {
  refund: FailedRefund;
  resolution: RefundResolution;
}

// "Reembolsos pendientes" -- refunds Mercado Pago refused when a paid booking was called
// off (the owner rejected it or never answered, the driver cancelled, an account closed).
// payment-service retries the passing failures on its own; what's here is still owed to
// the driver until an admin retries it, marks it as returned some other way, or discards
// it (nothing to give back, e.g. test data).
export default function FailedRefunds() {
  const [refunds, setRefunds] = useState<FailedRefund[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUserDetail>>({});
  const [spots, setSpots] = useState<Record<string, ParkingSpot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResolution | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listFailedRefunds();

      // Best-effort: a spot or person that fails to load just shows its id.
      const spotIds = [...new Set(rows.flatMap((r) => (r.booking ? [r.booking.parkingSpotId] : [])))];
      const spotResults = await Promise.allSettled(spotIds.map((id) => getParkingSpotById(id)));
      const loadedSpots: Record<string, ParkingSpot> = {};
      spotResults.forEach((result, i) => {
        if (result.status === 'fulfilled') loadedSpots[spotIds[i]] = result.value;
      });

      const userIds = [...new Set([
        ...rows.flatMap((r) => (r.booking ? [r.booking.userId] : [])),
        ...Object.values(loadedSpots).map((s) => s.ownerId),
      ])];
      const userResults = await Promise.allSettled(userIds.map((id) => getUserDetail(id)));
      const loadedUsers: Record<string, AdminUserDetail> = {};
      userResults.forEach((result, i) => {
        if (result.status === 'fulfilled') loadedUsers[userIds[i]] = result.value;
      });

      setSpots(loadedSpots);
      setUsers(loadedUsers);
      // Shown only once the spot and both people are in, so a card never reads "couldn't
      // load" for someone who's still loading.
      setRefunds(rows);
      return rows;
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los reembolsos pendientes.');
      return null;
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

  async function retry(refund: FailedRefund) {
    setRetrying(refund.paymentId);
    setNotice(null);
    try {
      await retryFailedRefund(refund.paymentId);
      setRefunds((prev) => prev.filter((r) => r.paymentId !== refund.paymentId));
      setNotice(`Listo: Mercado Pago le devolvió ${formatCentavos(refund.amount * 100)} al conductor.`);
    } catch {
      // Failed again -- reload to show the new reason and attempt count.
      const rows = await load();
      const updated = rows?.find((r) => r.paymentId === refund.paymentId);
      setNotice(`Mercado Pago lo volvió a rechazar. ${updated ? errorText(updated) : ''}`.trim());
    } finally {
      setRetrying(null);
    }
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader
          title="Reembolsos pendientes"
          subtitle="Reservas pagas que se cancelaron, pero Mercado Pago no pudo devolverle la plata al conductor. Las fallas pasajeras se reintentan solas; el resto se resuelve acá."
        />

        {loading && refunds.length === 0 ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={18} color={colors.teal} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Pressable onPress={() => setNotice(null)} hitSlop={8} style={CURSOR_POINTER}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && refunds.length === 0 ? (
          <Text style={styles.hint}>No hay reembolsos pendientes. Todo lo cancelado se devolvió.</Text>
        ) : null}

        <FlatList
          data={refunds}
          keyExtractor={(r) => r.paymentId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const b = item.booking;
            const spot = b ? spots[b.parkingSpotId] : undefined;
            const permanent = !!item.errorCode && item.errorCode !== 'transient';
            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable
                    onPress={() => spot && router.push(`/(admin)/spots/${spot.id}`)}
                    disabled={!spot}
                    style={({ hovered }: PressableState) => [styles.spotLink, hovered && styles.hovered, spot && CURSOR_POINTER]}
                    accessibilityRole="link"
                  >
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {spot?.title ?? (b ? b.parkingSpotId : `Pago ${item.paymentId}`)}
                    </Text>
                    {spot ? <Ionicons name="chevron-forward" size={14} color={colors.teal} /> : null}
                  </Pressable>
                  <Text style={styles.amount}>{formatCentavos(item.amount * 100)}</Text>
                </View>
                {spot ? <Text style={styles.caption}>{spot.address}</Text> : null}
                {b ? (
                  <Text style={styles.caption}>
                    {formatShortDateTime(b.start)} → {formatShortDateTime(b.end)} · {bookingKindText(b.kind)}
                    {b.cancellationReason ? ` · ${CANCELLATION_TEXT[b.cancellationReason] ?? b.cancellationReason}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.caption}>No se pudo cargar la reserva{item.bookingId ? ` (ID: ${item.bookingId})` : ''}.</Text>
                )}

                <View style={[styles.reason, permanent ? styles.reasonPermanent : styles.reasonTransient]}>
                  <Ionicons
                    name={permanent ? 'alert-circle' : 'time'}
                    size={16}
                    color={permanent ? colors.danger : colors.warning}
                  />
                  <View style={styles.reasonText}>
                    <Text style={styles.reasonTitle}>{errorText(item)}</Text>
                    <Text style={styles.reasonMeta}>
                      Último intento: {formatShortDateTime(item.failedAt)} · {retryText(item)} · Pago {item.paymentId}
                    </Text>
                  </View>
                </View>

                {b ? (
                  <View style={styles.parties}>
                    <PartyContact label="Conductor (a quien se le debe)" user={users[b.userId] ?? null} fallbackId={b.userId} compact />
                    <PartyContact
                      label="Propietario"
                      user={spot ? users[spot.ownerId] ?? null : null}
                      fallbackId={spot?.ownerId}
                      compact
                    />
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {b ? <Button title="Ver reserva" variant="secondary" onPress={() => openBooking(item)} /> : null}
                  <View style={styles.actionsSpacer} />
                  <Button
                    title="Descartar"
                    variant="danger"
                    onPress={() => setPending({ refund: item, resolution: 'discarded' })}
                    disabled={retrying !== null}
                  />
                  <Button
                    title="Ya se devolvió a mano"
                    variant="secondary"
                    onPress={() => setPending({ refund: item, resolution: 'refunded_manually' })}
                    disabled={retrying !== null}
                  />
                  <Button
                    title="Reintentar"
                    onPress={() => retry(item)}
                    loading={retrying === item.paymentId}
                    disabled={retrying !== null && retrying !== item.paymentId}
                  />
                </View>
              </Card>
            );
          }}
        />
      </View>

      <ResolveRefundModal
        pending={pending}
        onClose={() => setPending(null)}
        onResolved={(paymentId, resolution) => {
          setPending(null);
          setRefunds((prev) => prev.filter((r) => r.paymentId !== paymentId));
          setNotice(resolution === 'discarded' ? 'Reembolso descartado.' : 'Reembolso marcado como devuelto a mano.');
        }}
      />
    </Screen>
  );
}

/** Confirms closing a failed refund by hand, with a note (required to discard one). */
function ResolveRefundModal({
  pending,
  onClose,
  onResolved,
}: {
  pending: PendingResolution | null;
  onClose: () => void;
  onResolved: (paymentId: string, resolution: RefundResolution) => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discard = pending?.resolution === 'discarded';
  const noteMissing = discard && note.trim().length < 3;

  function close() {
    if (saving) return;
    setNote('');
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!pending || noteMissing) return;
    setSaving(true);
    setError(null);
    try {
      await resolveFailedRefund(pending.refund.paymentId, pending.resolution, note.trim());
      setNote('');
      onResolved(pending.refund.paymentId, pending.resolution);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const amount = pending ? formatCentavos(pending.refund.amount * 100) : '';
  return (
    <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{discard ? 'Descartar reembolso' : 'Marcar como devuelto a mano'}</Text>
              <Text style={styles.sheetBody}>
                {discard
                  ? `No se le devuelven ${amount} al conductor y el reembolso deja de figurar como pendiente. Usalo solo cuando no se debe nada, por ejemplo con datos de prueba. No se puede deshacer.`
                  : `Para cuando le devolviste ${amount} al conductor por otro medio, por ejemplo una transferencia. El conductor lo va a ver como reembolsado. No se puede deshacer.`}
              </Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                multiline
                editable={!saving}
                placeholder={discard ? 'Por qué se descarta (obligatorio)' : 'Cómo y cuándo se devolvió (opcional)'}
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={styles.sheetCaption}>Queda registrado junto con tu usuario.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.sheetActions}>
                <Pressable
                  style={({ hovered }: PressableState) => [styles.cancelBtn, hovered && styles.cancelBtnHovered, CURSOR_POINTER]}
                  onPress={close}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Button
                  title={discard ? 'Descartar' : 'Confirmar'}
                  variant={discard ? 'danger' : 'primary'}
                  onPress={confirm}
                  loading={saving}
                  disabled={noteMissing}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  noticeText: { flex: 1, fontSize: 13, color: colors.text },

  list: { paddingVertical: 12, gap: 12 },
  card: { gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  spotLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: 6 },
  hovered: { backgroundColor: colors.background },
  cardTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  caption: { fontSize: 13, color: colors.textSecondary },

  reason: { flexDirection: 'row', gap: 8, marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  reasonPermanent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  reasonTransient: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  reasonText: { flex: 1, gap: 2 },
  reasonTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  reasonMeta: { fontSize: 12, color: colors.textSecondary },

  parties: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, alignItems: 'center' },
  actionsSpacer: { flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, gap: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  sheetCaption: { fontSize: 12, color: colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, minHeight: 70,
    fontSize: 14, color: colors.text, textAlignVertical: 'top', marginTop: 4,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelBtnHovered: { backgroundColor: colors.background },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
