import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Badge, SpotStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { searchParkingSpots } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { ParkingSpot } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Publicadas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'pending_review', label: 'En revisión' },
  { value: 'suspended', label: 'Suspendidas' },
  { value: 'rejected', label: 'Rechazadas' },
];

// "Cocheras" -- every spot on the platform (not only the new ones waiting for review),
// searchable by title or address. Opening one gives the moderation actions: suspend a
// published spot, or restore one ParkLink suspended.
export default function Spots() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSpots(await searchParkingSpots(status, query.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las cocheras.');
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Cocheras" subtitle="Todas las cocheras publicadas o en proceso. Abrí una para suspenderla o restaurarla." />
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Título o dirección"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === status;
            return (
              <Pressable
                key={f.value}
                onPress={() => setStatus(f.value)}
                style={({ hovered }: PressableState) => [styles.chip, active && styles.chipActive, hovered && !active && styles.hovered, CURSOR_POINTER]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={spots}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.meta}>No hay cocheras con esos filtros.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(admin)/spots/${item.id}` as never)}
              style={({ hovered }: PressableState) => [CURSOR_POINTER, hovered && { opacity: 0.85 }]}
            >
              <Card style={styles.row}>
                {item.photos[0] ? (
                  <Image source={{ uri: item.photos[0] }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.caption} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={styles.rowSide}>
                  {item.suspendedByAdmin ? <Badge label="SUSPENDIDA" color={colors.danger} /> : <SpotStatusBadge status={item.status} />}
                </View>
              </Card>
            </Pressable>
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, gap: 12, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
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
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.border },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  rowSide: { alignItems: 'flex-end' },
});
