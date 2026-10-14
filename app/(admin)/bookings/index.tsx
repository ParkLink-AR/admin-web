import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { BookingStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { formatShortDateTime } from '@/src/services/dates';
import { BOOKING_STATUS_TEXT, CANCELLATION_TEXT } from '@/src/services/labels';
import { centavosToDecimal, downloadCsv } from '@/src/services/csv';
import { searchBookings } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminBooking, BookingStatus } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;
const PAGE_SIZE = 50;

const STATUS_FILTERS: { value: BookingStatus | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'PENDING_OWNER_APPROVAL', label: BOOKING_STATUS_TEXT.PENDING_OWNER_APPROVAL },
  { value: 'CONFIRMED', label: BOOKING_STATUS_TEXT.CONFIRMED },
  { value: 'IN_PROGRESS', label: BOOKING_STATUS_TEXT.IN_PROGRESS },
  { value: 'COMPLETED', label: BOOKING_STATUS_TEXT.COMPLETED },
  { value: 'CANCELLED', label: BOOKING_STATUS_TEXT.CANCELLED },
  { value: 'PENDING_PAYMENT', label: BOOKING_STATUS_TEXT.PENDING_PAYMENT },
  { value: 'EXPIRED', label: BOOKING_STATUS_TEXT.EXPIRED },
];

/** "2026-10-13" (from a date input) as the start of that day in Buenos Aires, RFC3339. */
function dayStart(date: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00-03:00` : undefined;
}

function dayEnd(date: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59-03:00` : undefined;
}

// "Reservas" -- every booking on the platform, searchable by its id or a plate, filtered by
// status and dates, newest first. Opening one shows it in full, with its chat and the
// cancel/refund actions.
export default function Bookings() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useCallback(
    (offset: number, limit = PAGE_SIZE) => ({
      q: query.trim(), status, from: dayStart(from), to: dayEnd(to), limit, offset,
    }),
    [query, status, from, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchBookings(filters(page * PAGE_SIZE));
      setRows(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las reservas.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // Every booking matching the filters (not just this page), for accounting.
  async function exportCsv() {
    setExporting(true);
    try {
      const all: AdminBooking[] = [];
      for (let offset = 0; offset < Math.min(total, 5000); offset += 200) {
        all.push(...(await searchBookings(filters(offset, 200))).items);
      }
      downloadCsv(`reservas-${new Date().toISOString().slice(0, 10)}.csv`, all, [
        { header: 'ID', value: (b) => b.id },
        { header: 'Estado', value: (b) => BOOKING_STATUS_TEXT[b.status] ?? b.status },
        { header: 'Tipo', value: (b) => (b.kind === 'STAY' ? 'Estadía' : 'Por hora') },
        { header: 'Desde', value: (b) => b.start },
        { header: 'Hasta', value: (b) => b.end },
        { header: 'Cochera (ID)', value: (b) => b.parkingSpotId },
        { header: 'Conductor (ID)', value: (b) => b.userId },
        { header: 'Patente', value: (b) => b.vehiclePlate },
        { header: 'Pagó el conductor', value: (b) => centavosToDecimal(b.amount) },
        { header: 'Le corresponde al propietario', value: (b) => centavosToDecimal(b.ownerAmount) },
        { header: 'Reembolsado por ParkLink', value: (b) => centavosToDecimal(b.refundedAmount) },
        { header: 'Pago (Mercado Pago)', value: (b) => b.paymentId },
        { header: 'Pagado', value: (b) => b.paidAt },
        { header: 'Motivo de cancelación', value: (b) => (b.cancellationReason ? CANCELLATION_TEXT[b.cancellationReason] ?? b.cancellationReason : '') },
        { header: 'Creada', value: (b) => b.createdAt },
      ]);
    } catch {
      setError('No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Reservas" subtitle="Todas las reservas de la plataforma. Buscá por ID de reserva o patente." />

        <View style={styles.filters}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setPage(0);
              }}
              placeholder="ID de reserva o patente"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Desde</Text>
            <TextInput style={styles.dateInput} value={from} onChangeText={(v) => { setFrom(v); setPage(0); }} placeholder="AAAA-MM-DD" placeholderTextColor={colors.textSecondary} />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Hasta</Text>
            <TextInput style={styles.dateInput} value={to} onChangeText={(v) => { setTo(v); setPage(0); }} placeholder="AAAA-MM-DD" placeholderTextColor={colors.textSecondary} />
          </View>
          <Button title="Exportar CSV" variant="secondary" onPress={exportCsv} loading={exporting} disabled={total === 0} />
        </View>

        <View style={styles.chips}>
          {STATUS_FILTERS.map((f) => {
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
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.meta}>{loading ? 'Buscando…' : `${total} ${total === 1 ? 'reserva' : 'reservas'}`}</Text>

        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.meta}>No hay reservas con esos filtros.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(admin)/bookings/${item.id}` as never)}
              style={({ hovered }: PressableState) => [CURSOR_POINTER, hovered && { opacity: 0.85 }]}
            >
              <Card style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {formatShortDateTime(item.start)} → {formatShortDateTime(item.end)}
                  </Text>
                  <Text style={styles.caption}>
                    {item.kind === 'STAY' ? 'Estadía' : 'Por hora'}
                    {item.vehiclePlate ? ` · ${item.vehiclePlate}` : ''} · ID {item.id.slice(0, 8)}
                  </Text>
                  {item.cancellationReason ? (
                    <Text style={styles.caption}>{CANCELLATION_TEXT[item.cancellationReason] ?? item.cancellationReason}</Text>
                  ) : null}
                </View>
                <View style={styles.rowSide}>
                  <BookingStatusBadge status={item.status} />
                  <Text style={styles.amount}>{formatCentavos(item.amount)}</Text>
                  {item.refundedAmount > 0 ? <Text style={styles.refunded}>−{formatCentavos(item.refundedAmount)}</Text> : null}
                </View>
              </Card>
            </Pressable>
          )}
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  searchBox: {
    flex: 1, minWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  dateField: { gap: 2 },
  dateLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  dateInput: {
    width: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 14, color: colors.text, backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hovered: { backgroundColor: colors.background },
  error: { color: colors.danger, fontSize: 14 },
  meta: { fontSize: 13, color: colors.textSecondary },
  list: { gap: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  rowSide: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 14, fontWeight: '700', color: colors.text },
  refunded: { fontSize: 12, fontWeight: '600', color: colors.danger },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
});
