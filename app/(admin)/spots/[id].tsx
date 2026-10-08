import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Linking,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { SpotStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { getParkingSpotById, getUserDetail } from '@/src/api/admin';
import { AdminUserDetail, ParkingSpot } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { formatShortDateTime } from '@/src/services/dates';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return formatShortDateTime(iso);
}

function ownerDisplayName(u: AdminUserDetail) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

export default function SpotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [owner, setOwner] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const s = await getParkingSpotById(id);
        if (cancelled) return;
        setSpot(s);
        try {
          const o = await getUserDetail(s.ownerId);
          if (!cancelled) setOwner(o);
        } catch {
          // Owner lookup failing shouldn't hide the spot's own data -- just
          // no clickable name to show.
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : 'No se pudo cargar la cochera.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (error || !spot) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Cochera no encontrada.'}</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title="Detalle de cochera" showBack />

        {spot.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {spot.photos.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.hint}>Sin fotos</Text>
          </View>
        )}

        <Card>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{spot.title}</Text>
            <SpotStatusBadge status={spot.status} />
          </View>
          <Text style={styles.detailLine}>{spot.address}</Text>
          <Text style={styles.caption}>ID: {spot.id}</Text>

          <Pressable
            onPress={() => owner && router.push(`/(admin)/users/${spot.ownerId}`)}
            disabled={!owner}
            style={({ hovered }: PressableState) => [
              styles.ownerRow,
              hovered && owner && styles.ownerRowHovered,
              owner ? CURSOR_POINTER : undefined,
            ]}
          >
            <Ionicons name="person-circle-outline" size={18} color={colors.teal} />
            <Text style={styles.ownerText}>
              Publicada por: {owner ? ownerDisplayName(owner) : spot.ownerId}
            </Text>
            {owner ? <Ionicons name="chevron-forward" size={14} color={colors.teal} /> : null}
          </Pressable>
        </Card>

        {spot.verificationPhotos.length > 0 || spot.reviewNotes || spot.status === 'pending_review' ? (
          <Card>
            <Text style={styles.sectionTitle}>Documentación de respaldo</Text>
            {spot.verificationPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
                {spot.verificationPhotos.map((url) => (
                  <Pressable key={url} onPress={() => Linking.openURL(url)} style={CURSOR_POINTER}>
                    <Image source={{ uri: url }} style={styles.photo} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>El dueño todavía no subió documentación.</Text>
            )}
            {spot.reviewNotes ? (
              <Text style={styles.detailLine}>
                {spot.status === 'rejected' ? 'Motivo del rechazo' : 'Comentario de la revisión'}: {spot.reviewNotes}
              </Text>
            ) : null}
            {spot.status === 'pending_review' ? (
              <Pressable
                onPress={() => router.push('/(admin)/spot-review')}
                style={({ hovered }: PressableState) => [styles.ownerRow, hovered && styles.ownerRowHovered, CURSOR_POINTER]}
              >
                <Text style={styles.ownerText}>Revisar en la cola de cocheras nuevas</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.teal} />
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {spot.description ? (
          <Card>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.detailLine}>{spot.description}</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Precios</Text>
          {spot.hourlyEnabled && spot.pricePerHour != null ? (
            <DataRow label="Por hora" value={`$${spot.pricePerHour.toLocaleString('es-AR')}`} />
          ) : null}
          {spot.stayEnabled && spot.pricePerDay != null ? (
            <DataRow label="Por día" value={`$${spot.pricePerDay.toLocaleString('es-AR')}`} />
          ) : null}
          {spot.stayEnabled && spot.pricePerWeek != null ? (
            <DataRow label="Por semana" value={`$${spot.pricePerWeek.toLocaleString('es-AR')}`} />
          ) : null}
          {spot.stayEnabled && spot.pricePerMonth != null ? (
            <DataRow label="Por mes" value={`$${spot.pricePerMonth.toLocaleString('es-AR')}`} />
          ) : null}
          {!spot.hourlyEnabled && !spot.stayEnabled ? (
            <Text style={styles.hint}>Sin precio configurado</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Detalles</Text>
          <DataRow label="Techada" value={spot.covered ? 'Sí' : 'No'} />
          <DataRow label="Capacidad" value={String(spot.capacity)} />
          <DataRow label="Vehículos" value={spot.vehicleTypes.join(', ') || '-'} />
          <DataRow label="Rating" value={spot.rating != null ? `${spot.rating.toFixed(1)} (${spot.reviewCount})` : 'Sin reseñas'} />
          <DataRow label="Creada" value={formatDate(spot.createdAt)} />
          <DataRow label="Actualizada" value={formatDate(spot.updatedAt)} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
  body: { padding: 24, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' },
  gallery: { flexGrow: 0 },
  photo: { width: 220, height: 150, borderRadius: 12, marginRight: 10, backgroundColor: colors.surface },
  noPhoto: {
    height: 120, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  hint: { fontSize: 13, color: colors.textSecondary },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text, flex: 1 },
  detailLine: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start', padding: 4, borderRadius: 6 },
  ownerRowHovered: { backgroundColor: colors.background },
  ownerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dataLabel: { fontSize: 13, color: colors.textSecondary },
  dataValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
});
