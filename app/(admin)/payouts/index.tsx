import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { PayoutStatusBadge } from '@/src/components/Badge';
import { PayoutDetailPanel } from '@/src/components/PayoutDetailPanel';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { listPayouts } from '@/src/api/admin';
import { Payout, PayoutStatus } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Payouts() {
  const [status, setStatus] = useState<PayoutStatus>('PENDING');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const load = useCallback(async (s: PayoutStatus) => {
    setLoading(true);
    setError(null);
    try {
      setPayouts(await listPayouts(s));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los pagos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  // Refresh when returning from the narrow-window full-page detail route
  // (e.g. right after marking one as paid) so it disappears from "Pendientes".
  useFocusEffect(
    useCallback(() => {
      load(status);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])
  );

  function selectPayout(id: string) {
    if (isDesktop) {
      setSelectedId(id);
    } else {
      router.push(`/(admin)/payouts/${id}`);
    }
  }

  function switchStatus(s: PayoutStatus) {
    setStatus(s);
    setSelectedId(null);
  }

  // On desktop, once a payout is marked paid it should drop out of the
  // "Pendientes" tab immediately -- reload the list and clear the selection
  // if it no longer belongs in the current tab.
  function handleChanged(updated: Payout) {
    load(status);
    if (updated.status !== status) setSelectedId(null);
  }

  const list = (
    <View style={isDesktop ? styles.listPaneDesktop : styles.listPaneFull}>
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, status === 'PENDING' && styles.tabActive]}
          onPress={() => switchStatus('PENDING')}
        >
          <Text style={[styles.tabText, status === 'PENDING' && styles.tabTextActive]}>Pendientes</Text>
        </Pressable>
        <Pressable style={[styles.tab, status === 'PAID' && styles.tabActive]} onPress={() => switchStatus('PAID')}>
          <Text style={[styles.tabText, status === 'PAID' && styles.tabTextActive]}>Pagados</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && payouts.length === 0 ? (
        <Text style={styles.hint}>
          {status === 'PENDING' ? 'No hay pagos pendientes.' : 'Todavía no se pagó ningún payout.'}
        </Text>
      ) : null}

      <FlatList
        data={payouts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => selectPayout(item.id)}
            style={[styles.row, isDesktop && item.id === selectedId && styles.rowSelected]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.amount}>{formatCentavos(item.netAmount)}</Text>
              <Text style={styles.caption}>Dueño: {item.ownerId}</Text>
              <Text style={styles.caption}>Reserva: {item.bookingId}</Text>
              <Text style={styles.caption}>Creado: {formatDate(item.createdAt)}</Text>
            </View>
            <PayoutStatusBadge status={item.status} />
          </Pressable>
        )}
      />
    </View>
  );

  if (isDesktop) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.desktopHeaderWrap}>
          <PageHeader title="Pagos pendientes" subtitle="Seleccioná un pago de la lista para ver el detalle." />
        </View>
        <View style={styles.desktopBody}>
          {list}
          <View style={styles.detailPane}>
            {selectedId ? (
              <PayoutDetailPanel key={selectedId} payoutId={selectedId} onChanged={handleChanged} />
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={styles.hint}>Seleccioná un pago para ver el detalle.</Text>
              </View>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.mobileHeaderWrap}>
        <PageHeader title="Pagos pendientes" />
      </View>
      {list}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // Desktop master-detail: header spans full width, then a row of
  // [list pane | detail pane] below it.
  desktopHeaderWrap: { padding: 24, paddingBottom: 0, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  desktopBody: { flex: 1, flexDirection: 'row', padding: 24, gap: 20, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  listPaneDesktop: { width: 380 },
  listPaneFull: { flex: 1 },
  detailPane: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  emptyDetail: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  mobileHeaderWrap: { padding: 16, paddingBottom: 0 },

  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  row: {
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
  rowSelected: { borderColor: colors.teal, borderWidth: 2 },
  amount: { fontSize: 17, fontWeight: '700', color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
