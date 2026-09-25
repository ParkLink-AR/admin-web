import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { AccountTypeBadge, UserStatusBadge, SpotStatusBadge, BookingStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import {
  getUserDetail,
  getUserParkingSpots,
  getUserBookingHistory,
  getOwnerReceivedBookings,
} from '@/src/api/admin';
import { AdminUserDetail, ParkingSpot, DriverBooking, OwnerReceivedBooking } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

type Tab = 'spots' | 'made' | 'received';
type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayName(u: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [madeBookings, setMadeBookings] = useState<DriverBooking[]>([]);
  const [receivedBookings, setReceivedBookings] = useState<OwnerReceivedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('spots');
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const detail = await getUserDetail(id);
        if (cancelled) return;
        setUser(detail);
        const isOwner = detail.accountType === 'OWNER' || detail.accountType === 'BOTH';
        const [spotsResult, madeResult, receivedResult] = await Promise.allSettled([
          getUserParkingSpots(id),
          getUserBookingHistory(id),
          isOwner ? getOwnerReceivedBookings(id) : Promise.resolve<OwnerReceivedBooking[]>([]),
        ]);
        if (cancelled) return;
        if (spotsResult.status === 'fulfilled') setSpots(spotsResult.value);
        if (madeResult.status === 'fulfilled') setMadeBookings(madeResult.value);
        if (receivedResult.status === 'fulfilled') setReceivedBookings(receivedResult.value);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el usuario.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (error || !user) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Usuario no encontrado.'}</Text>
      </Screen>
    );
  }

  const isOwner = user.accountType === 'OWNER' || user.accountType === 'BOTH';

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title="Detalle de usuario" showBack />

        {/* Profile info and "Datos de cobro" side-by-side on desktop --
            stacked on a narrow window/phone. */}
        <View style={[styles.topRow, isDesktop && styles.topRowDesktop]}>
          <Card style={isDesktop ? styles.topRowCol : styles.topRowColStacked}>
            <Text style={styles.name}>{displayName(user)}</Text>
            <Text style={styles.detailLine}>{user.email}</Text>
            {user.phone ? <Text style={styles.detailLine}>{user.phone}</Text> : null}
            <View style={styles.badgeRow}>
              <AccountTypeBadge accountType={user.accountType} />
              <UserStatusBadge status={user.status} />
            </View>
            <View style={styles.verifyRow}>
              <VerifyChip label="Email" verified={user.emailVerified} />
              <VerifyChip label="Teléfono" verified={user.phoneVerified} />
            </View>
            <Text style={styles.caption}>Alta: {formatDate(user.createdAt)}</Text>
            {user.lastLoginAt ? (
              <Text style={styles.caption}>Último ingreso: {formatDate(user.lastLoginAt)}</Text>
            ) : (
              <Text style={styles.caption}>Nunca inició sesión.</Text>
            )}
          </Card>

          <Card style={isDesktop ? styles.topRowCol : styles.topRowColStacked}>
            <Text style={styles.sectionTitle}>Datos de cobro</Text>
            {user.hasPayoutInfo ? (
              <>
                <DataRow label="CBU" value={user.cbu ?? '-'} />
                <DataRow label="Titular" value={user.payoutTitular ?? '-'} />
                <DataRow label="CUIL" value={user.cuil ?? '-'} />
              </>
            ) : (
              <Text style={styles.hint}>Datos de cobro no cargados.</Text>
            )}
          </Card>
        </View>

        <View style={styles.tabBar}>
          <TabButton label="Cocheras" active={tab === 'spots'} onPress={() => setTab('spots')} />
          <TabButton label="Reservas hechas" active={tab === 'made'} onPress={() => setTab('made')} />
          {isOwner ? (
            <TabButton label="Reservas recibidas" active={tab === 'received'} onPress={() => setTab('received')} />
          ) : null}
        </View>

        {tab === 'spots' ? (
          spots.length === 0 ? (
            <Text style={styles.hint}>No tiene cocheras publicadas.</Text>
          ) : (
            spots.map((s) => (
              <Card key={s.id} style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.title}</Text>
                  <Text style={styles.caption}>{s.address}</Text>
                  <Text style={styles.caption}>{spotPriceLine(s)}</Text>
                </View>
                <SpotStatusBadge status={s.status} />
              </Card>
            ))
          )
        ) : null}

        {tab === 'made' ? (
          madeBookings.length === 0 ? (
            <Text style={styles.hint}>No hizo reservas.</Text>
          ) : (
            madeBookings.map((b) => <BookingRow key={b.id} booking={b} />)
          )
        ) : null}

        {tab === 'received' && isOwner ? (
          receivedBookings.length === 0 ? (
            <Text style={styles.hint}>No recibió reservas.</Text>
          ) : (
            receivedBookings.map((b) => <BookingRow key={b.id} booking={b} />)
          )
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function spotPriceLine(s: ParkingSpot): string {
  const parts: string[] = [];
  if (s.hourlyEnabled && s.pricePerHour != null) {
    parts.push(`$${s.pricePerHour.toLocaleString('es-AR')}/hora`);
  }
  if (s.stayEnabled && s.pricePerDay != null) {
    parts.push(`$${s.pricePerDay.toLocaleString('es-AR')}/día`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sin precio configurado';
}

function VerifyChip({ label, verified }: { label: string; verified: boolean }) {
  return (
    <View style={styles.verifyChip}>
      <Ionicons
        name={verified ? 'checkmark-circle' : 'close-circle'}
        size={14}
        color={verified ? colors.success : colors.textSecondary}
      />
      <Text style={styles.verifyChipText}>{label}</Text>
    </View>
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

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: PressableState) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        hovered && !active && styles.tabButtonHovered,
        CURSOR_POINTER,
      ]}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BookingRow({ booking }: { booking: DriverBooking | OwnerReceivedBooking }) {
  return (
    <Card style={styles.rowCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>
          {formatDate(booking.start)} → {formatDate(booking.end)}
        </Text>
        <Text style={styles.caption}>
          {booking.kind === 'HOURLY' ? 'Por hora' : 'Estadía'} · {formatCentavos(booking.amount)}
        </Text>
        {booking.cancellationReason ? (
          <Text style={styles.caption}>Motivo: {booking.cancellationReason}</Text>
        ) : null}
      </View>
      <BookingStatusBadge status={booking.status} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
  body: { padding: 24, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  topRow: { gap: 14 },
  topRowDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  topRowCol: { flex: 1 },
  topRowColStacked: {},
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  detailLine: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  verifyRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  verifyChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifyChipText: { fontSize: 12, color: colors.textSecondary },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  hint: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dataLabel: { fontSize: 13, color: colors.textSecondary },
  dataValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  tabButtonHovered: { backgroundColor: colors.background },
  tabButtonText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabButtonTextActive: { color: colors.white },
  rowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
});
