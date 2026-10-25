import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getOwnerPendingBalances } from '@/src/api/admin';
import { PendingCount, usePendingCounts } from '@/src/hooks/usePendingCounts';
import { formatCentavos } from '@/src/services/money';
import { MetricsPanel } from '@/src/components/MetricsPanel';

type PressableState = { pressed: boolean; hovered?: boolean };

// A loaded figure: undefined while loading, null if its request failed.
type Figure<T> = T | null | undefined;

function useFigure<T>(load: () => Promise<T>): Figure<T> {
  const [value, setValue] = useState<Figure<T>>(undefined);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((v) => !cancelled && setValue(v))
      .catch(() => !cancelled && setValue(null));
    return () => {
      cancelled = true;
    };
    // `load` is a module-level API call per figure -- it never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

function hoverable(hovered: boolean | undefined) {
  return [{ cursor: 'pointer' } as unknown as ViewStyle, hovered && styles.hovered];
}

function PendingTile({ count, label, detail, icon, href }: {
  count: PendingCount;
  label: string;
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}) {
  const pending = typeof count === 'number' && count > 0;
  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ hovered }: PressableState) => [styles.pendingWrap, ...hoverable(hovered)]}
    >
      <Card style={pending ? { ...styles.pendingCard, ...styles.pendingCardActive } : styles.pendingCard}>
        <View style={styles.pendingTop}>
          <Ionicons name={icon} size={18} color={pending ? colors.warning : colors.textSecondary} />
          {count === undefined ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : (
            <Text style={[styles.pendingCount, pending && styles.pendingCountActive]}>
              {count === null ? '—' : count}
            </Text>
          )}
        </View>
        <Text style={styles.pendingLabel}>{label}</Text>
        <Text style={[styles.pendingDetail, count === 0 && styles.pendingDetailDone]}>
          {count === null ? 'No se pudo cargar' : count === 0 ? 'Todo al día' : detail ?? ' '}
        </Text>
      </Card>
    </Pressable>
  );
}

// The line above the tiles: how many things wait, in how many sections -- or that all is done.
function Summary({ counts }: { counts: PendingCount[] }) {
  if (counts.some((count) => count === undefined)) return null;
  const waiting = counts.filter((count): count is number => typeof count === 'number' && count > 0);
  const total = waiting.reduce((sum, count) => sum + count, 0);
  const failed = counts.some((count) => count === null);
  const done = total === 0;
  return (
    <Card style={done ? { ...styles.summary, ...styles.summaryDone } : styles.summary}>
      <Ionicons name={done ? 'checkmark-circle' : 'notifications'} size={22} color={done ? colors.success : colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryTitle}>
          {done
            ? 'Todo al día: no hay nada esperando'
            : `${total} ${total === 1 ? 'cosa para atender' : 'cosas para atender'}${
                waiting.length > 1 ? ` en ${waiting.length} secciones` : ''
              }`}
        </Text>
        <Text style={styles.summaryDetail}>
          {failed
            ? 'Alguna sección no se pudo cargar: la marcamos con «—».'
            : done
              ? 'Se actualiza solo cada minuto.'
              : 'Las secciones con algo pendiente están marcadas abajo y con su número en el menú.'}
        </Text>
      </View>
    </Card>
  );
}

export default function Home() {
  const user = useSessionStore((s) => s.user);
  const counts = usePendingCounts();
  const balances = useFigure(getOwnerPendingBalances);

  const balancesTotal = balances ? balances.reduce((sum, b) => sum + b.pendingNetAmount, 0) : 0;

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title={`Hola, ${user?.username ?? ''}`} subtitle="Panel de administración de ParkLink" />

        <Summary
          counts={[counts.spotReview, counts.unverified, counts.tickets, counts.reports, counts.refunds, counts.settlements]}
        />

        <Text style={styles.heading}>Para atender ahora</Text>
        <View style={styles.pendingRow}>
          <PendingTile
            count={counts.spotReview}
            label="Cocheras nuevas"
            detail="Esperando aprobación para publicarse"
            icon="checkmark-done-circle"
            href="/(admin)/spot-review"
          />
          <PendingTile
            count={counts.unverified}
            label="Reservas sin verificar"
            detail="Con el pago al dueño retenido"
            icon="alert-circle"
            href="/(admin)/unverified"
          />
          <PendingTile
            count={counts.tickets}
            label="Soporte sin responder"
            detail="Tickets esperando respuesta de ParkLink"
            icon="chatbubbles"
            href="/(admin)/support"
          />
          <PendingTile
            count={counts.reports}
            label="Denuncias sin resolver"
            detail="Cocheras, usuarios o reseñas"
            icon="flag"
            href="/(admin)/reports"
          />
          <PendingTile
            count={counts.refunds}
            label="Reembolsos pendientes"
            detail="Mercado Pago no los pudo hacer"
            icon="arrow-undo-circle"
            href="/(admin)/refunds"
          />
          <PendingTile
            count={counts.settlements}
            label="Liquidaciones sin confirmar"
            detail="Preparadas, falta la transferencia"
            icon="receipt"
            href="/(admin)/settlements"
          />
          <PendingTile
            count={balances === undefined || balances === null ? balances : balances.length}
            label="Dueños con saldo a pagar"
            detail={balances ? `${formatCentavos(balancesTotal)} en total` : undefined}
            icon="cash"
            href="/(admin)/payouts"
          />
        </View>

        <Text style={styles.heading}>Métricas</Text>
        <MetricsPanel />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  hovered: { transform: [{ translateY: -1 }], opacity: 0.92 },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: colors.warning },
  summaryDone: { borderLeftColor: colors.success },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  summaryDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  heading: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },

  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pendingWrap: { flexGrow: 1, flexBasis: 220, minWidth: 200, borderRadius: 14 },
  pendingCard: { gap: 4, height: '100%' },
  pendingCardActive: { borderWidth: 1, borderColor: colors.warning },
  pendingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 },
  pendingCount: { fontSize: 28, fontWeight: '700', color: colors.textSecondary },
  pendingCountActive: { color: colors.text },
  pendingLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  pendingDetail: { fontSize: 12, color: colors.textSecondary },
  pendingDetailDone: { color: colors.success, fontWeight: '600' },
});
