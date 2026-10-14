import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getAdminMetrics } from '@/src/api/admin';
import { AdminMetrics } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;
const PERIODS = [7, 30, 90];
const CHART_HEIGHT = 120;

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {detail ? <Text style={styles.kpiDetail}>{detail}</Text> : null}
    </Card>
  );
}

function shortDay(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
}

// How the platform is doing over a period: paid bookings, money moved, ParkLink's cut,
// refunds, and a bar per day of paid bookings.
export function MetricsPanel() {
  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState<AdminMetrics | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getAdminMetrics(days)
      .then((m) => !cancelled && setMetrics(m))
      .catch(() => !cancelled && setMetrics(null));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const peak = metrics ? Math.max(1, ...metrics.daily.map((d) => d.paid)) : 1;
  const cancelled = metrics ? metrics.statusCounts.CANCELLED ?? 0 : 0;
  const totalBookings = metrics ? Object.values(metrics.statusCounts).reduce((a, b) => a + (b ?? 0), 0) : 0;
  // Only a handful of day labels under the bars, so they don't pile up on long periods.
  const labelEvery = metrics ? Math.max(1, Math.ceil(metrics.daily.length / 8)) : 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.periods}>
        {PERIODS.map((p) => {
          const active = p === days;
          return (
            <Pressable
              key={p}
              onPress={() => {
                setMetrics(undefined);
                setDays(p);
              }}
              style={({ hovered }: PressableState) => [styles.chip, active && styles.chipActive, hovered && !active && styles.chipHovered, CURSOR_POINTER]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>Últimos {p} días</Text>
            </Pressable>
          );
        })}
      </View>

      {metrics === undefined ? (
        <ActivityIndicator color={colors.teal} />
      ) : metrics === null ? (
        <Text style={styles.muted}>No se pudieron cargar las métricas.</Text>
      ) : (
        <>
          <View style={styles.kpis}>
            <Kpi label="Reservas pagas" value={String(metrics.paidBookings)} detail={`${totalBookings} creadas en el período`} />
            <Kpi label="Facturado" value={formatCentavos(metrics.grossAmount)} detail="Lo que pagaron los conductores" />
            <Kpi label="Comisión de ParkLink" value={formatCentavos(metrics.commission)} />
            <Kpi label="Reembolsado" value={formatCentavos(metrics.refunded)} detail={`${cancelled} ${cancelled === 1 ? 'reserva cancelada' : 'reservas canceladas'}`} />
          </View>
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Reservas pagas por día</Text>
            <View style={styles.chart}>
              {metrics.daily.map((d) => (
                <View key={d.date} style={styles.barSlot}>
                  <View
                    // On web the title shows as a tooltip with the exact figures.
                    {...({ title: `${shortDay(d.date)}: ${d.paid} pagas · ${formatCentavos(d.amount)}` } as object)}
                    style={[styles.bar, { height: Math.max(2, (d.paid / peak) * CHART_HEIGHT) }, d.paid === 0 && styles.barEmpty]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.axis}>
              {metrics.daily.map((d, i) => (
                <Text key={d.date} style={styles.axisLabel} numberOfLines={1}>
                  {i % labelEvery === 0 ? shortDay(d.date) : ''}
                </Text>
              ))}
            </View>
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  chipHovered: { backgroundColor: colors.background },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  muted: { fontSize: 13, color: colors.textSecondary },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { flexGrow: 1, flexBasis: 200, minWidth: 180, gap: 2 },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  kpiValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  kpiDetail: { fontSize: 12, color: colors.textSecondary },
  chartCard: { gap: 8 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 2 },
  barSlot: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  bar: { backgroundColor: colors.teal, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barEmpty: { backgroundColor: colors.border },
  axis: { flexDirection: 'row', gap: 2 },
  axisLabel: { flex: 1, fontSize: 10, color: colors.textSecondary, overflow: 'visible' },
});
