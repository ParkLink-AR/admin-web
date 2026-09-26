import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { SettlementStatusBadge } from '@/src/components/Badge';
import { SettlementDetailPanel } from '@/src/components/SettlementDetailPanel';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { listSettlements } from '@/src/api/admin';
import { Settlement, SettlementStatus } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "Liquidaciones" -- the confirm/pay queue for batched Settlements, one tap deeper than
// the "Saldos pendientes" list (payouts/index.tsx) where drafts are created. Same
// desktop two-pane master-detail / narrow-window full-page-route split that the old
// per-payout payouts/index.tsx used, just rebuilt around Settlement instead of Payout.
export default function Settlements() {
  const [status, setStatus] = useState<SettlementStatus>('PENDING');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const load = useCallback(async (s: SettlementStatus) => {
    setLoading(true);
    setError(null);
    try {
      setSettlements(await listSettlements(s));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las liquidaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  // Refresh when returning from the narrow-window full-page detail route (e.g. right
  // after confirming or cancelling one) so it disappears from "A confirmar".
  useFocusEffect(
    useCallback(() => {
      load(status);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])
  );

  function selectSettlement(id: string) {
    if (isDesktop) {
      setSelectedId(id);
    } else {
      router.push(`/(admin)/settlements/${id}`);
    }
  }

  function switchStatus(s: SettlementStatus) {
    setStatus(s);
    setSelectedId(null);
  }

  // On desktop, once a settlement is confirmed it should drop out of the "A confirmar"
  // tab immediately -- reload and clear the selection since it no longer belongs here.
  function handleConfirmed(updated: Settlement) {
    load(status);
    if (updated.status !== status) setSelectedId(null);
  }

  // A cancelled settlement stops existing entirely -- reload the current tab and clear
  // the selection (there's nothing left to show in the detail pane).
  function handleCancelled() {
    load(status);
    setSelectedId(null);
  }

  const list = (
    <View style={isDesktop ? styles.listPaneDesktop : styles.listPaneFull}>
      <View style={styles.tabBar}>
        <Pressable
          style={({ hovered }: PressableState) => [
            styles.tab,
            status === 'PENDING' && styles.tabActive,
            hovered && status !== 'PENDING' && styles.tabHovered,
            CURSOR_POINTER,
          ]}
          onPress={() => switchStatus('PENDING')}
        >
          <Text style={[styles.tabText, status === 'PENDING' && styles.tabTextActive]}>A confirmar</Text>
        </Pressable>
        <Pressable
          style={({ hovered }: PressableState) => [
            styles.tab,
            status === 'PAID' && styles.tabActive,
            hovered && status !== 'PAID' && styles.tabHovered,
            CURSOR_POINTER,
          ]}
          onPress={() => switchStatus('PAID')}
        >
          <Text style={[styles.tabText, status === 'PAID' && styles.tabTextActive]}>Pagadas</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && settlements.length === 0 ? (
        <Text style={styles.hint}>
          {status === 'PENDING' ? 'No hay liquidaciones para confirmar.' : 'Todavía no se pagó ninguna liquidación.'}
        </Text>
      ) : null}

      <FlatList
        data={settlements}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => selectSettlement(item.id)}
            style={({ hovered }: PressableState) => [
              styles.row,
              isDesktop && item.id === selectedId && styles.rowSelected,
              hovered && item.id !== selectedId && styles.rowHovered,
              CURSOR_POINTER,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.amount}>{formatCentavos(item.netAmount)}</Text>
              <Text style={styles.caption}>Dueño: {item.ownerId}</Text>
              <Text style={styles.caption}>Creado: {formatDate(item.createdAt)}</Text>
            </View>
            <SettlementStatusBadge status={item.status} />
          </Pressable>
        )}
      />
    </View>
  );

  if (isDesktop) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.desktopHeaderWrap}>
          <PageHeader title="Liquidaciones" subtitle="Seleccioná una liquidación de la lista para ver el detalle." />
        </View>
        <View style={styles.desktopBody}>
          {list}
          <View style={styles.detailPane}>
            {selectedId ? (
              <SettlementDetailPanel
                key={selectedId}
                settlementId={selectedId}
                onConfirmed={handleConfirmed}
                onCancelled={handleCancelled}
              />
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={styles.hint}>Seleccioná una liquidación para ver el detalle.</Text>
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
        <PageHeader title="Liquidaciones" />
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
  tabHovered: { backgroundColor: colors.background },
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
  rowHovered: { backgroundColor: colors.background },
  amount: { fontSize: 17, fontWeight: '700', color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
