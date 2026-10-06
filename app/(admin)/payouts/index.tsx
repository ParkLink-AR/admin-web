import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getOwnerPendingBalances, getUserDetail } from '@/src/api/admin';
import { OwnerPendingBalance } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "Saldos pendientes" -- the new starting screen for "who do I owe money to", now that
// booking-service batches payouts into per-owner Settlements instead of paying each
// booking payout individually. One row per owner who currently has >=1 unattached
// pending payout (see GET /admin/owners/pending-balances). Tapping a row goes to
// payouts/owner/[id].tsx to review the bookings and draft a settlement. The confirm/pay
// queue itself now lives one tap deeper, at (admin)/settlements.
export default function OwnerPendingBalances() {
  const [balances, setBalances] = useState<OwnerPendingBalance[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getOwnerPendingBalances();
      setBalances(rows);
      // Best-effort display names -- this endpoint only returns owner ids, so resolve
      // each one via the existing admin user-detail lookup, same as users/[id].tsx does
      // for spot owners. A failed lookup just falls back to showing the raw id.
      const results = await Promise.allSettled(rows.map((r) => getUserDetail(r.ownerId)));
      const resolved: Record<string, string> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const u = result.value;
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
          resolved[rows[i].ownerId] = name || u.email;
        }
      });
      setNames(resolved);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los saldos pendientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh every time this screen regains focus -- e.g. coming back after drafting (or
  // cancelling) a settlement, so a settled owner drops out of the list.
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function openOwner(ownerId: string) {
    router.push(`/(admin)/payouts/owner/${ownerId}`);
  }

  function ownerLabel(ownerId: string) {
    return names[ownerId] ?? ownerId;
  }

  const body = (
    <>
      {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && balances.length === 0 ? (
        <Text style={styles.hint}>No hay saldos pendientes de pago.</Text>
      ) : null}

      {isDesktop && balances.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colOwner]}>Dueño</Text>
            <Text style={[styles.th, styles.colAmount]}>Saldo pendiente</Text>
            <Text style={[styles.th, styles.colCount]}>Reservas</Text>
            <Text style={[styles.th, styles.colDate]}>Pendiente desde</Text>
            <View style={styles.colChevron} />
          </View>
          <FlatList
            data={balances}
            keyExtractor={(b) => b.ownerId}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openOwner(item.ownerId)}
                style={({ hovered }: PressableState) => [styles.tableRow, hovered && styles.tableRowHovered, CURSOR_POINTER]}
              >
                <Text style={[styles.td, styles.colOwner]} numberOfLines={1}>{ownerLabel(item.ownerId)}</Text>
                <Text style={[styles.tdAmount, styles.colAmount]}>{formatCentavos(item.pendingNetAmount)}</Text>
                <Text style={[styles.tdSecondary, styles.colCount]}>{item.pendingCount}</Text>
                <Text style={[styles.tdSecondary, styles.colDate]}>{formatDate(item.oldestPendingAt)}</Text>
                <View style={styles.colChevron}>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {!isDesktop ? (
        <FlatList
          data={balances}
          keyExtractor={(b) => b.ownerId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openOwner(item.ownerId)}
              style={({ hovered }: PressableState) => [styles.card, hovered && styles.cardHovered, CURSOR_POINTER]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.amount}>{formatCentavos(item.pendingNetAmount)}</Text>
                <Text style={styles.caption}>Dueño: {ownerLabel(item.ownerId)}</Text>
                <Text style={styles.caption}>
                  {item.pendingCount} {item.pendingCount === 1 ? 'reserva' : 'reservas'} · desde{' '}
                  {formatDate(item.oldestPendingAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      ) : null}
    </>
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader
          title="Saldos pendientes"
          subtitle="Seleccioná un dueño para revisar sus reservas y preparar la liquidación."
        />
        {body}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },

  // Desktop table.
  table: { flex: 1, marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowHovered: { backgroundColor: colors.background },
  td: { fontSize: 14, color: colors.text, fontWeight: '600' },
  tdAmount: { fontSize: 14, color: colors.text, fontWeight: '700' },
  tdSecondary: { fontSize: 13, color: colors.textSecondary },
  colOwner: { flex: 3 },
  colAmount: { flex: 2 },
  colCount: { flex: 1 },
  colDate: { flex: 2 },
  colChevron: { width: 20, alignItems: 'flex-end' },

  // Narrow (stacked card) layout.
  list: { paddingVertical: 12, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHovered: { backgroundColor: colors.background },
  amount: { fontSize: 17, fontWeight: '700', color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
