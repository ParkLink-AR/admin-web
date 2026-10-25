import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { PartyContact } from '@/src/components/PartyContact';
import { PendingVerificationDecision, VerificationDecisionModal } from '@/src/components/VerificationDecisionModal';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getParkingSpotById, getUserDetail, listUnverifiedBookings } from '@/src/api/admin';
import { AdminUserDetail, ParkingSpot, UnverifiedBooking } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { formatShortDateTime } from '@/src/services/dates';
import { bookingKindText } from '@/src/services/labels';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

/** Opens the booking's full detail page (cochera, both sides, payment) -- the same page the
 * user pages link to, told it's one still waiting for this review. */
function openUnverifiedBooking(item: UnverifiedBooking) {
  router.push({
    pathname: '/(admin)/bookings/[id]',
    params: {
      id: item.id,
      parkingSpotId: item.parkingSpotId,
      userId: item.userId,
      start: item.start,
      end: item.end,
      status: 'COMPLETED',
      amount: String(item.amount),
      ownerAmount: item.ownerAmount != null ? String(item.ownerAmount) : '',
      paymentId: item.paymentId ?? '',
      paidAt: item.paidAt ?? '',
      cancellationReason: '',
      kind: item.kind,
      updatedAt: '',
      vehiclePlate: item.vehiclePlate ?? '',
      verificationReview: 'PENDING',
    },
  });
}

// "Sin verificar" -- paid bookings that completed without the owner ever entering the
// driver's in-person arrival code. booking-service holds back each one's payout until an
// admin decides here: approve it (the stay is accepted as having happened and the owner
// gets paid in the next settlement) or refund the driver (the owner is never paid for it).
export default function UnverifiedBookings() {
  const [bookings, setBookings] = useState<UnverifiedBooking[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUserDetail>>({});
  const [spots, setSpots] = useState<Record<string, ParkingSpot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingVerificationDecision | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listUnverifiedBookings();

      // Best-effort: a spot or person that fails to load just shows its id.
      const spotIds = [...new Set(rows.map((r) => r.parkingSpotId))];
      const spotResults = await Promise.allSettled(spotIds.map((id) => getParkingSpotById(id)));
      const loadedSpots: Record<string, ParkingSpot> = {};
      spotResults.forEach((result, i) => {
        if (result.status === 'fulfilled') loadedSpots[spotIds[i]] = result.value;
      });
      setSpots(loadedSpots);

      const userIds = [...new Set([...rows.map((r) => r.userId), ...Object.values(loadedSpots).map((s) => s.ownerId)])];
      const userResults = await Promise.allSettled(userIds.map((id) => getUserDetail(id)));
      const loadedUsers: Record<string, AdminUserDetail> = {};
      userResults.forEach((result, i) => {
        if (result.status === 'fulfilled') loadedUsers[userIds[i]] = result.value;
      });
      setUsers(loadedUsers);
      // Shown only once the spot and both people are in, so a card never reads "couldn't
      // load" for someone who's still loading.
      setBookings(rows);
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
            const spot = spots[item.parkingSpotId];
            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable
                    onPress={() => spot && router.push(`/(admin)/spots/${spot.id}`)}
                    disabled={!spot}
                    style={({ hovered }: PressableState) => [styles.spotLink, hovered && styles.hovered, spot && CURSOR_POINTER]}
                    accessibilityRole="link"
                  >
                    <Text style={styles.cardTitle} numberOfLines={1}>{spot?.title ?? item.parkingSpotId}</Text>
                    {spot ? <Ionicons name="chevron-forward" size={14} color={colors.teal} /> : null}
                  </Pressable>
                  <Text style={styles.amount}>{formatCentavos(item.amount)}</Text>
                </View>
                {spot ? <Text style={styles.caption}>{spot.address}</Text> : null}
                <Text style={styles.caption}>
                  {formatShortDateTime(item.start)} → {formatShortDateTime(item.end)} · {bookingKindText(item.kind)}
                  {item.vehiclePlate ? ` · Patente ${item.vehiclePlate}` : ''}
                  {item.ownerAmount != null ? ` · Al dueño: ${formatCentavos(item.ownerAmount)}` : ''}
                </Text>

                <View style={styles.parties}>
                  <PartyContact label="Conductor" user={users[item.userId] ?? null} fallbackId={item.userId} compact />
                  <PartyContact
                    label="Propietario"
                    user={spot ? users[spot.ownerId] ?? null : null}
                    fallbackId={spot?.ownerId}
                    compact
                  />
                </View>

                <View style={styles.actions}>
                  <Button title="Ver reserva" variant="secondary" onPress={() => openUnverifiedBooking(item)} />
                  <View style={styles.actionsSpacer} />
                  <Button
                    title="Reembolsar al conductor"
                    variant="danger"
                    onPress={() => setPending({ bookingId: item.id, amount: item.amount, decision: 'REFUNDED' })}
                  />
                  <Button
                    title="Aprobar pago al dueño"
                    onPress={() => setPending({ bookingId: item.id, amount: item.amount, decision: 'APPROVED' })}
                  />
                </View>
              </Card>
            );
          }}
        />
      </View>

      <VerificationDecisionModal
        pending={pending}
        onClose={() => setPending(null)}
        onResolved={(bookingId) => {
          setPending(null);
          setBookings((prev) => prev.filter((b) => b.id !== bookingId));
        }}
      />
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
  spotLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: 6 },
  hovered: { backgroundColor: colors.background },
  cardTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  caption: { fontSize: 13, color: colors.textSecondary },
  parties: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, alignItems: 'center' },
  actionsSpacer: { flex: 1 },
});
