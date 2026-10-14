import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { formatShortDateTime } from '@/src/services/dates';
import { formatCentavos } from '@/src/services/money';
import { getAuditLog } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AuditEntry } from '@/src/types';

const PAGE_SIZE = 50;

// What an action on a path means, in words -- the most common ones; anything else shows
// its method and path as is.
const ACTION_TEXT: [RegExp, string][] = [
  [/^POST \/admin\/bookings\/[^/]+\/cancel$/, 'Canceló una reserva'],
  [/^POST \/admin\/bookings\/[^/]+\/refund$/, 'Reembolsó una reserva'],
  [/^POST \/admin\/bookings\/[^/]+\/verification-review$/, 'Decidió una reserva sin verificar'],
  [/^PATCH \/admin\/parking-spots\/[^/]+\/review$/, 'Revisó una cochera nueva'],
  [/^PATCH \/admin\/parking-spots\/[^/]+\/moderation$/, 'Moderó una cochera'],
  [/^POST \/admin\/reviews\/[^/]+\/hide$/, 'Ocultó una reseña'],
  [/^POST \/admin\/reviews\/[^/]+\/restore$/, 'Volvió a mostrar una reseña'],
  [/^POST \/admin\/reports\/[^/]+\/resolve$/, 'Cerró una denuncia'],
  [/^POST \/admin\/users\/[^/]+\/suspend$/, 'Suspendió una cuenta'],
  [/^POST \/admin\/users\/[^/]+\/reactivate$/, 'Reactivó una cuenta'],
  [/^POST \/admin\/users\/[^/]+\/deletion$/, 'Eliminó una cuenta'],
  [/^POST \/admin\/refunds\/[^/]+\/retry$/, 'Reintentó un reembolso'],
  [/^POST \/admin\/refunds\/[^/]+\/resolve$/, 'Cerró un reembolso pendiente'],
  [/^POST \/admin\/owners\/[^/]+\/settlements$/, 'Preparó una liquidación'],
  [/^POST \/admin\/settlements\/[^/]+\/confirm$/, 'Confirmó una liquidación'],
  [/^POST \/admin\/settlements\/[^/]+\/cancel$/, 'Canceló una liquidación'],
  [/^PUT \/admin\/settings\/commission$/, 'Cambió la comisión'],
  [/^POST \/admin\/tickets\/[^/]+\/messages$/, 'Respondió un ticket'],
  [/^PATCH \/admin\/tickets\/[^/]+\/status$/, 'Cambió el estado de un ticket'],
  [/^POST \/admin\/broadcasts$/, 'Mandó un aviso'],
  [/^POST \/admin\/accounts$/, 'Creó un administrador'],
  [/^PATCH \/admin\/accounts\/[^/]+$/, 'Modificó un administrador'],
  [/^POST \/admin\/accounts\/[^/]+\/password$/, 'Cambió la contraseña de un administrador'],
];

function describe(entry: AuditEntry): string {
  const key = `${entry.method} ${entry.path}`;
  return ACTION_TEXT.find(([pattern]) => pattern.test(key))?.[1] ?? key;
}

// The gateway's summary is "key: value · key: value" with the request body's field names --
// shown in words, amounts (centavos) as money.
const FIELD_TEXT: Record<string, string> = {
  reason: 'Motivo', note: 'Nota', notes: 'Notas', status: 'Estado', decision: 'Decisión', action: 'Acción',
  amount: 'Monto', refund_amount: 'Reembolso', resolution: 'Resolución', commission_rate_bp: 'Comisión',
  title: 'Título', audience: 'Para', is_active: 'Activa', role: 'Rol', username: 'Usuario',
};
const FIELD_SPLIT = new RegExp(`(?:^| · )(${Object.keys(FIELD_TEXT).join('|')}): `);

function readableSummary(summary: string): string {
  // split() with a capture group alternates [before, key, value, key, value, ...].
  const parts = summary.split(FIELD_SPLIT);
  if (parts.length < 3) return summary;
  const out: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i];
    let value = parts[i + 1] ?? '';
    if ((key === 'amount' || key === 'refund_amount') && /^\d+$/.test(value)) value = formatCentavos(Number(value));
    else if (key === 'commission_rate_bp' && /^\d+$/.test(value)) value = `${Number(value) / 100}%`;
    else if (value === 'True' || value === 'true') value = 'sí';
    else if (value === 'False' || value === 'false') value = 'no';
    out.push(`${FIELD_TEXT[key]}: ${value}`);
  }
  return out.join(' · ');
}

// "Registro de acciones" -- every change an admin made from the panel (recorded by the
// gateway), newest first: who, what, when and why (the reason or note they wrote).
export default function AuditLog() {
  const [admin, setAdmin] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLog({ admin: admin.trim(), query: query.trim(), limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setEntries(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el registro.');
    } finally {
      setLoading(false);
    }
  }, [admin, query, page]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Registro de acciones" subtitle="Todo lo que los administradores cambiaron desde el panel: quién, qué, cuándo y por qué." />
        <View style={styles.filters}>
          <View style={styles.searchBox}>
            <Ionicons name="person" size={15} color={colors.textSecondary} />
            <TextInput style={styles.searchInput} value={admin} onChangeText={(t) => { setAdmin(t); setPage(0); }} placeholder="Usuario del admin" placeholderTextColor={colors.textSecondary} />
          </View>
          <View style={[styles.searchBox, { flex: 2 }]}>
            <Ionicons name="search" size={15} color={colors.textSecondary} />
            <TextInput style={styles.searchInput} value={query} onChangeText={(t) => { setQuery(t); setPage(0); }} placeholder="Buscar en la acción o el motivo (ID, palabra…)" placeholderTextColor={colors.textSecondary} />
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.meta}>No hay acciones registradas con esos filtros.</Text>}
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.action}>
                  <Text style={styles.who}>{item.adminUsername ?? 'admin'}</Text> · {describe(item)}
                </Text>
                {item.summary ? <Text style={styles.summary}>{readableSummary(item.summary)}</Text> : null}
                <Text style={styles.meta}>{item.method} {item.path}</Text>
              </View>
              <Text style={styles.meta}>{formatShortDateTime(item.createdAt)}</Text>
            </Card>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  searchBox: {
    flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  meta: { fontSize: 12, color: colors.textSecondary },
  list: { gap: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowMain: { flex: 1, gap: 3 },
  action: { fontSize: 14, color: colors.text },
  who: { fontWeight: '700' },
  summary: { fontSize: 13, color: colors.text },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
});
