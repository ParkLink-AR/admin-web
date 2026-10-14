import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { displayName } from '@/src/components/PartyContact';
import { ActionModal, ActionModalConfig } from '@/src/components/ActionModal';
import { colors } from '@/src/theme/colors';
import { formatShortDateTime } from '@/src/services/dates';
import { getParkingSpotById, getUserDetail, hideReview, listAdminReviews, restoreReview } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AdminReview } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

type Filter = 'visible' | 'hidden' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'visible', label: 'Publicadas' },
  { value: 'hidden', label: 'Ocultas' },
  { value: 'all', label: 'Todas' },
];

const TARGET_TEXT: Record<AdminReview['targetType'], string> = {
  spot: 'Cochera',
  owner: 'Propietario',
  driver: 'Conductor',
};

// "Reseñas" -- the latest reviews, to hide one that's offensive or fake. A hidden review
// stays on record but leaves every public listing and average; it can be shown again.
export default function Reviews() {
  const [filter, setFilter] = useState<Filter>('visible');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  // Names of the people and spots involved, best effort.
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionModalConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAdminReviews(filter === 'all' ? undefined : filter === 'hidden');
      setReviews(rows);
      const userIds = [...new Set(rows.flatMap((r) => (r.targetType === 'spot' ? [r.reviewerId] : [r.reviewerId, r.targetId])))];
      const spotIds = [...new Set(rows.filter((r) => r.targetType === 'spot').map((r) => r.targetId))];
      const [userResults, spotResults] = await Promise.all([
        Promise.allSettled(userIds.map((id) => getUserDetail(id))),
        Promise.allSettled(spotIds.map((id) => getParkingSpotById(id))),
      ]);
      const loaded: Record<string, string> = {};
      userResults.forEach((r, i) => r.status === 'fulfilled' && (loaded[userIds[i]] = displayName(r.value)));
      spotResults.forEach((r, i) => r.status === 'fulfilled' && (loaded[spotIds[i]] = r.value.title));
      setNames(loaded);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las reseñas.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function openHide(review: AdminReview) {
    setAction({
      title: 'Ocultar la reseña',
      description: 'Deja de mostrarse en la app y no cuenta para el promedio. Queda guardada y la podés volver a mostrar.',
      confirmLabel: 'Ocultar',
      variant: 'danger',
      notePlaceholder: 'Ej.: lenguaje ofensivo',
      onConfirm: async (note) => {
        await hideReview(review.id, note);
        await load();
      },
    });
  }

  async function restore(review: AdminReview) {
    try {
      await restoreReview(review.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo volver a mostrar.');
    }
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Reseñas" subtitle="Las últimas reseñas de la plataforma. Ocultá las ofensivas o falsas: dejan de verse y no cuentan para el promedio." />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={({ hovered }: PressableState) => [styles.chip, active && styles.chipActive, hovered && !active && styles.hovered, CURSOR_POINTER]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.meta}>No hay reseñas acá.</Text>}
          renderItem={({ item }) => (
            <Card style={StyleSheet.flatten([styles.card, item.hiddenAt ? styles.cardHidden : null])}>
              <View style={styles.header}>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons key={n} name={n <= item.rating ? 'star' : 'star-outline'} size={14} color={colors.warning} />
                  ))}
                </View>
                <Text style={styles.meta}>{formatShortDateTime(item.createdAt)}</Text>
                {item.hiddenAt ? <Badge label="OCULTA" color={colors.textSecondary} /> : null}
              </View>
              <Text style={styles.comment}>{item.comment || <Text style={styles.meta}>(sin comentario)</Text>}</Text>
              <Text style={styles.meta}>
                {TARGET_TEXT[item.targetType]}: {names[item.targetId] ?? item.targetId.slice(0, 8)} · por {names[item.reviewerId] ?? 'usuario'}
              </Text>
              {item.hiddenReason ? <Text style={styles.meta}>Motivo: {item.hiddenReason}</Text> : null}
              <View style={styles.actions}>
                <Pressable onPress={() => router.push(`/(admin)/bookings/${item.bookingId}` as never)} style={CURSOR_POINTER}>
                  <Text style={styles.link}>Ver la reserva</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                {item.hiddenAt ? (
                  <Button title="Volver a mostrar" variant="secondary" onPress={() => restore(item)} />
                ) : (
                  <Button title="Ocultar" variant="secondary" onPress={() => openHide(item)} />
                )}
              </View>
            </Card>
          )}
        />
      </View>
      <ActionModal config={action} onClose={() => setAction(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, gap: 12, maxWidth: 900, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hovered: { backgroundColor: colors.background },
  error: { color: colors.danger, fontSize: 14 },
  meta: { fontSize: 12, color: colors.textSecondary },
  list: { gap: 10, paddingBottom: 12 },
  card: { gap: 6 },
  cardHidden: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stars: { flexDirection: 'row', gap: 1 },
  comment: { fontSize: 14, color: colors.text, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  link: { fontSize: 13, fontWeight: '700', color: colors.teal },
});
