import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Badge, BookingStatusBadge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { formatShortDateTime } from '@/src/services/dates';
import { BOOKING_STATUS_TEXT } from '@/src/services/labels';
import { downloadCsv } from '@/src/services/csv';
import { listPayments } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminPayment } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;
const PAGE_SIZE = 50;

const STATUS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'refunded', label: 'Reembolsados' },
  { value: 'refund_failed', label: 'Reembolso fallido' },
  { value: 'pending', label: 'Pendientes' },
];

const STATUS_TEXT: Record<string, { label: string; color: string }> = {
  approved: { label: 'APROBADO', color: colors.success },
  rejected: { label: 'RECHAZADO', color: colors.danger },
  cancelled: { label: 'CANCELADO', color: colors.textSecondary },
  refunded: { label: 'REEMBOLSADO', color: colors.teal },
  refund_failed: { label: 'REEMBOLSO FALLIDO', color: colors.warning },
  refunded_manually: { label: 'REEMBOLSADO A MANO', color: colors.teal },
  refund_discarded: { label: 'REEMBOLSO DESCARTADO', color: colors.textSecondary },
  pending: { label: 'PENDIENTE', color: colors.warning },
  in_process: { label: 'EN PROCESO', color: colors.warning },
};

function pesos(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "Pagos" -- every Mercado Pago payment, with the booking it paid for. One approved by
// Mercado Pago whose booking never got paid on ParkLink's side is flagged: the money moved
// but the driver has no booking (a webhook that never arrived, a hold that ran out).
export default function Payments() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPayments({ q: query.trim(), status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los pagos.');
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    try {
      const all: AdminPayment[] = [];
      for (let offset = 0; offset < Math.min(total, 5000); offset += 200) {
        all.push(...(await listPayments({ q: query.trim(), status, limit: 200, offset })).items);
      }
      downloadCsv(`pagos-${new Date().toISOString().slice(0, 10)}.csv`, all, [
        { header: 'Pago (Mercado Pago)', value: (p) => p.paymentId },
        { header: 'Reserva', value: (p) => p.bookingId },
        { header: 'Estado', value: (p) => STATUS_TEXT[p.status]?.label ?? p.status },
        { header: 'Monto', value: (p) => p.amount.toFixed(2) },
        { header: 'Reembolsado parcial', value: (p) => p.refundedAmount.toFixed(2) },
        { header: 'Moneda', value: (p) => p.currency },
        { header: 'Pagador', value: (p) => p.payerEmail },
        { header: 'Aprobado', value: (p) => p.approvedAt },
        { header: 'Creado', value: (p) => p.createdAt },
        { header: 'Estado de la reserva', value: (p) => (p.bookingStatus ? BOOKING_STATUS_TEXT[p.bookingStatus] : '') },
        { header: 'Revisar', value: (p) => (p.needsAttention ? 'Sí' : '') },
      ]);
    } catch {
      setError('No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  }

  const visible = onlyProblems ? rows.filter((p) => p.needsAttention) : rows;
  const problems = rows.filter((p) => p.needsAttention).length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Pagos" subtitle="Todos los pagos de Mercado Pago con su reserva. Los marcados en rojo se cobraron pero la reserva no quedó paga." />
        <View style={styles.filters}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(t) => { setQuery(t); setPage(0); }}
              placeholder="ID de pago, ID de reserva o email del pagador"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Button title="Exportar CSV" variant="secondary" onPress={exportCsv} loading={exporting} disabled={total === 0} />
        </View>
        <View style={styles.chips}>
          {STATUS.map((f) => {
            const active = f.value === status;
            return (
              <Pressable
                key={f.label}
                onPress={() => { setStatus(f.value); setPage(0); }}
                style={({ hovered }: PressableState) => [styles.chip, active && styles.chipActive, hovered && !active && styles.hovered, CURSOR_POINTER]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setOnlyProblems((v) => !v)}
            style={({ hovered }: PressableState) => [styles.chip, onlyProblems && styles.chipDanger, hovered && !onlyProblems && styles.hovered, CURSOR_POINTER]}
          >
            <Text style={[styles.chipText, onlyProblems && styles.chipTextActive]}>Solo a revisar ({problems})</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.meta}>{loading ? 'Buscando…' : `${total} ${total === 1 ? 'pago' : 'pagos'}`}</Text>
        <FlatList
          data={visible}
          keyExtractor={(p) => p.paymentId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.meta}>No hay pagos con esos filtros.</Text>}
          renderItem={({ item }) => {
            const s = STATUS_TEXT[item.status] ?? { label: item.status.toUpperCase(), color: colors.textSecondary };
            return (
              <Card style={StyleSheet.flatten([styles.row, item.needsAttention ? styles.rowAlert : null])}>
                <View style={styles.rowMain}>
                  <View style={styles.titleLine}>
                    <Text style={styles.rowTitle}>{pesos(item.amount)}</Text>
                    <Badge label={s.label} color={s.color} />
                    {item.refundedAmount > 0 ? <Text style={styles.refunded}>−{pesos(item.refundedAmount)} reembolsado</Text> : null}
                  </View>
                  <Text style={styles.caption}>
                    Pago {item.paymentId} · {formatShortDateTime(item.approvedAt ?? item.createdAt)}
                    {item.payerEmail ? ` · ${item.payerEmail}` : ''}
                  </Text>
                  {item.needsAttention ? (
                    <Text style={styles.alertText}>Mercado Pago lo aprobó, pero la reserva no quedó paga en ParkLink. Revisá si hay que reembolsarlo.</Text>
                  ) : null}
                </View>
                <View style={styles.rowSide}>
                  {item.bookingStatus ? <BookingStatusBadge status={item.bookingStatus} /> : <Text style={styles.caption}>Sin reserva</Text>}
                  {item.bookingId ? (
                    <Pressable onPress={() => router.push(`/(admin)/bookings/${item.bookingId}` as never)} style={CURSOR_POINTER}>
                      <Text style={styles.link}>Ver reserva</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
        {pages > 1 ? (
          <View style={styles.pager}>
            <Button title="Anterior" variant="secondary" onPress={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} />
            <Text style={styles.meta}>Página {page + 1} de {pages}</Text>
            <Button title="Siguiente" variant="secondary" onPress={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, gap: 12, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  searchBox: {
    flex: 1, minWidth: 260, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  chipDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hovered: { backgroundColor: colors.background },
  error: { color: colors.danger, fontSize: 14 },
  meta: { fontSize: 13, color: colors.textSecondary },
  list: { gap: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowAlert: { borderColor: colors.danger, borderWidth: 1.5 },
  rowMain: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  refunded: { fontSize: 12, fontWeight: '600', color: colors.danger },
  caption: { fontSize: 12, color: colors.textSecondary },
  alertText: { fontSize: 12, fontWeight: '600', color: colors.danger },
  rowSide: { alignItems: 'flex-end', gap: 6 },
  link: { fontSize: 13, fontWeight: '700', color: colors.teal },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
});
