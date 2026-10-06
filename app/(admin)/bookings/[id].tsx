import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { BookingStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getParkingSpotById, getUserDetail } from '@/src/api/admin';
import { AdminUserDetail, BookingStatus, ParkingSpot } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

// All values arrive as plain strings (router params), even though status/kind are really
// BookingStatus/BookingKind -- cast at the point of use (see the badge/label below).
interface BookingParams {
  id: string;
  parkingSpotId: string;
  userId: string;
  start: string;
  end: string;
  status: string;
  amount: string;
  paymentId: string;
  paidAt: string;
  cancellationReason: string;
  kind: string;
  updatedAt: string;
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

// There's no single GET /bookings/{id} endpoint this admin tool is allowed to call for an
// arbitrary booking (booking-service's is ownership-gated for the app's own users), so the
// caller (users/[id].tsx's BookingRow) passes the booking's own fields -- already fetched
// as part of the list -- straight through as route params instead of refetching them here.
export default function BookingDetail() {
  // Cast rather than pass BookingParams as the hook's type argument: expo-router's typed
  // routes overload resolution wants a route-path string literal there, not a plain params
  // shape (see users/[id].tsx's navigation call, which supplies these exact param names).
  const params = useLocalSearchParams() as unknown as BookingParams;
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [driver, setDriver] = useState<AdminUserDetail | null>(null);
  const [owner, setOwner] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.parkingSpotId || !params.userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [spotResult, driverResult] = await Promise.allSettled([
        getParkingSpotById(params.parkingSpotId),
        getUserDetail(params.userId),
      ]);
      if (cancelled) return;
      if (spotResult.status === 'fulfilled') {
        setSpot(spotResult.value);
        try {
          const o = await getUserDetail(spotResult.value.ownerId);
          if (!cancelled) setOwner(o);
        } catch {
          // No clickable owner name if this fails -- not fatal to the rest of the screen.
        }
      }
      if (driverResult.status === 'fulfilled') setDriver(driverResult.value);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.parkingSpotId, params.userId]);

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title="Detalle de reserva" showBack />

        <Card>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {formatDate(params.start)} → {formatDate(params.end)}
            </Text>
            <BookingStatusBadge status={params.status as BookingStatus} />
          </View>
          <Text style={styles.caption}>ID: {params.id}</Text>
          <DataRow label="Tipo" value={params.kind === 'HOURLY' ? 'Por hora' : 'Estadía'} />
          <DataRow label="Monto" value={formatCentavos(Number(params.amount))} />
          {params.paymentId ? <DataRow label="Pago (Mercado Pago)" value={params.paymentId} /> : null}
          {params.paidAt ? <DataRow label="Pagado" value={formatDate(params.paidAt)} /> : null}
          {params.cancellationReason ? <DataRow label="Motivo de cancelación" value={params.cancellationReason} /> : null}
          <DataRow label="Última actualización" value={formatDate(params.updatedAt)} />
        </Card>

        {loading ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 12 }} />
        ) : (
          <>
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
                    <Text style={styles.caption}>ID: {spot.id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : (
                <Text style={styles.hint}>No se pudo cargar la cochera (ID: {params.parkingSpotId}).</Text>
              )}
            </Card>

            <View style={styles.partiesRow}>
              <Card style={styles.partyCard}>
                <Text style={styles.sectionTitle}>Conductor</Text>
                {driver ? (
                  <Pressable
                    onPress={() => router.push(`/(admin)/users/${driver.id}`)}
                    style={({ hovered }: PressableState) => [styles.linkRow, hovered && styles.linkRowHovered, CURSOR_POINTER]}
                  >
                    <Ionicons name="person-circle-outline" size={18} color={colors.teal} />
                    <Text style={styles.linkTitle}>{displayName(driver)}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.teal} />
                  </Pressable>
                ) : (
                  <Text style={styles.hint}>No se pudo cargar.</Text>
                )}
              </Card>

              <Card style={styles.partyCard}>
                <Text style={styles.sectionTitle}>Propietario</Text>
                {owner ? (
                  <Pressable
                    onPress={() => router.push(`/(admin)/users/${owner.id}`)}
                    style={({ hovered }: PressableState) => [styles.linkRow, hovered && styles.linkRowHovered, CURSOR_POINTER]}
                  >
                    <Ionicons name="person-circle-outline" size={18} color={colors.teal} />
                    <Text style={styles.linkTitle}>{displayName(owner)}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.teal} />
                  </Pressable>
                ) : (
                  <Text style={styles.hint}>No se pudo cargar.</Text>
                )}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  caption: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dataLabel: { fontSize: 13, color: colors.textSecondary },
  dataValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textSecondary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4, borderRadius: 6 },
  linkRowHovered: { backgroundColor: colors.background },
  linkTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  partiesRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  partyCard: { flex: 1, minWidth: 220 },
});
