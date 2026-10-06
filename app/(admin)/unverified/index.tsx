import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getParkingSpotById, getUserDetail, listUnverifiedBookings, resolveVerificationReview } from '@/src/api/admin';
import { AdminUserDetail, UnverifiedBooking, VerificationReviewDecision } from '@/src/types';
import { ApiError } from '@/src/api/client';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

interface PendingDecision {
  booking: UnverifiedBooking;
  decision: VerificationReviewDecision;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayName(u: AdminUserDetail) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

// "Sin verificar" -- paid bookings that completed without the owner ever entering the
// driver's in-person arrival code. booking-service holds back each one's payout until an
// admin decides here: approve it (the stay is accepted as having happened and the owner
// gets paid in the next settlement) or refund the driver (the owner is never paid for it).
export default function UnverifiedBookings() {
  const [bookings, setBookings] = useState<UnverifiedBooking[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [spotNames, setSpotNames] = useState<Record<string, { title: string; ownerName?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listUnverifiedBookings();
      setBookings(rows);

      // Best-effort display names -- a failed lookup just falls back to the raw id.
      const driverIds = [...new Set(rows.map((r) => r.userId))];
      const spotIds = [...new Set(rows.map((r) => r.parkingSpotId))];
      const [drivers, spots] = await Promise.all([
        Promise.allSettled(driverIds.map((id) => getUserDetail(id))),
        Promise.allSettled(spotIds.map((id) => getParkingSpotById(id))),
      ]);
      const resolvedDrivers: Record<string, string> = {};
      drivers.forEach((result, i) => {
        if (result.status === 'fulfilled') resolvedDrivers[driverIds[i]] = displayName(result.value);
      });
      setDriverNames(resolvedDrivers);

      const resolvedSpots: Record<string, { title: string; ownerName?: string }> = {};
      await Promise.all(
        spots.map(async (result, i) => {
          if (result.status !== 'fulfilled') return;
          const spot = result.value;
          let ownerName: string | undefined;
          try {
            ownerName = displayName(await getUserDetail(spot.ownerId));
          } catch {
            // Owner name is optional context, not required to decide.
          }
          resolvedSpots[spotIds[i]] = { title: spot.title, ownerName };
        }),
      );
      setSpotNames(resolvedSpots);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las reservas sin verificar.');
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

  function askDecision(booking: UnverifiedBooking, decision: VerificationReviewDecision) {
    setResolveError(null);
    setPending({ booking, decision });
  }

  async function confirmDecision() {
    if (!pending) return;
    setResolving(true);
    setResolveError(null);
    try {
      await resolveVerificationReview(pending.booking.id, pending.decision);
      setPending(null);
      setBookings((prev) => prev.filter((b) => b.id !== pending.booking.id));
    } catch (err) {
      setResolveError(err instanceof ApiError ? err.detail : 'No se pudo guardar la decisión. Intentá de nuevo.');
    } finally {
      setResolving(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader
          title="Reservas sin verificar"
          subtitle="Reservas pagas que terminaron sin que el dueño cargara el código de llegada del conductor. El pago al dueño queda retenido hasta que decidas."
        />

        {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && bookings.length === 0 ? (
          <Text style={styles.hint}>No hay reservas sin verificar pendientes de revisión.</Text>
        ) : null}

        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const spot = spotNames[item.parkingSpotId];
            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{spot?.title ?? item.parkingSpotId}</Text>
                  <Text style={styles.amount}>{formatCentavos(item.amount)}</Text>
                </View>
                <Text style={styles.caption}>
                  {formatDate(item.start)} → {formatDate(item.end)} · {item.kind === 'HOURLY' ? 'Por hora' : 'Estadía'}
                </Text>
                <Text style={styles.caption}>Conductor: {driverNames[item.userId] ?? item.userId}</Text>
                <Text style={styles.caption}>Dueño: {spot?.ownerName ?? '—'}</Text>
                {item.vehiclePlate ? <Text style={styles.caption}>Patente: {item.vehiclePlate}</Text> : null}
                {item.ownerAmount != null ? (
                  <Text style={styles.caption}>Le corresponde al dueño: {formatCentavos(item.ownerAmount)}</Text>
                ) : null}
                <View style={styles.actions}>
                  <Button title="Reembolsar al conductor" variant="danger" onPress={() => askDecision(item, 'REFUNDED')} />
                  <Button title="Aprobar pago al dueño" onPress={() => askDecision(item, 'APPROVED')} />
                </View>
              </Card>
            );
          }}
        />
      </View>

      <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <TouchableWithoutFeedback onPress={() => !resolving && setPending(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>
                  {pending?.decision === 'REFUNDED' ? 'Reembolsar al conductor' : 'Aprobar pago al dueño'}
                </Text>
                <Text style={styles.modalBody}>
                  {pending?.decision === 'REFUNDED'
                    ? `Se le devuelven ${pending ? formatCentavos(pending.booking.amount) : ''} al conductor por Mercado Pago y el dueño no cobra esta reserva. No se puede deshacer.`
                    : 'La reserva se da por cumplida y el pago al dueño entra en su próxima liquidación. No se puede deshacer.'}
                </Text>
                {resolveError ? <Text style={styles.error}>{resolveError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalCancelBtn, hovered && styles.modalCancelBtnHovered, CURSOR_POINTER]}
                    onPress={() => setPending(null)}
                    disabled={resolving}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Button
                    title="Confirmar"
                    variant={pending?.decision === 'REFUNDED' ? 'danger' : 'primary'}
                    onPress={confirmDecision}
                    loading={resolving}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },

  list: { paddingVertical: 12, gap: 12 },
  card: { gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  caption: { fontSize: 13, color: colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, justifyContent: 'flex-end' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalCancelBtnHovered: { backgroundColor: colors.background },
  modalCancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
