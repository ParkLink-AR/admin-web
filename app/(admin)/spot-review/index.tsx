import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Linking,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { getUserDetail, listPendingParkingSpots, reviewParkingSpot } from '@/src/api/admin';
import { AdminUserDetail, ParkingSpot, SpotReviewDecision } from '@/src/types';
import { ApiError } from '@/src/api/client';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

// Rechazar sin explicar deja al dueño sin saber qué corregir -- el motivo es lo que ve en la app.
const MIN_REJECTION_NOTES = 5;

interface PendingDecision {
  spot: ParkingSpot;
  decision: SpotReviewDecision;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayName(u: AdminUserDetail) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

function priceSummary(spot: ParkingSpot) {
  const parts: string[] = [];
  if (spot.hourlyEnabled && spot.pricePerHour != null) parts.push(`$${spot.pricePerHour.toLocaleString('es-AR')}/hora`);
  if (spot.stayEnabled && spot.pricePerDay != null) parts.push(`$${spot.pricePerDay.toLocaleString('es-AR')}/día`);
  return parts.join(' · ') || 'Sin precio configurado';
}

// "Cocheras nuevas" -- toda cochera que un dueño crea arranca pendiente y no aparece en las
// búsquedas hasta que un admin la aprueba acá. El dueño sube fotos de respaldo (la cochera en
// sí, escritura, contrato de alquiler, expensas...) para que se pueda verificar que es real.
// Aprobarla la publica; rechazarla la deja fuera con el motivo, y el dueño tiene que cargarla
// de nuevo -- no hay forma de reabrir una revisión ya resuelta.
export default function SpotReviewQueue() {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [notes, setNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listPendingParkingSpots();
      setSpots(rows);

      // Best-effort: si falla la búsqueda del dueño se muestra el id.
      const ownerIds = [...new Set(rows.map((s) => s.ownerId))];
      const results = await Promise.allSettled(ownerIds.map((id) => getUserDetail(id)));
      const names: Record<string, string> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') names[ownerIds[i]] = displayName(result.value);
      });
      setOwnerNames(names);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las cocheras pendientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function askDecision(spot: ParkingSpot, decision: SpotReviewDecision) {
    setResolveError(null);
    setNotes('');
    setPending({ spot, decision });
  }

  function closeModal() {
    if (!resolving) setPending(null);
  }

  const trimmedNotes = notes.trim();
  const rejecting = pending?.decision === 'rejected';
  const canConfirm = !resolving && (!rejecting || trimmedNotes.length >= MIN_REJECTION_NOTES);

  async function confirmDecision() {
    if (!pending || !canConfirm) return;
    setResolving(true);
    setResolveError(null);
    try {
      await reviewParkingSpot(pending.spot.id, pending.decision, trimmedNotes || undefined);
      const reviewedId = pending.spot.id;
      setPending(null);
      setSpots((prev) => prev.filter((s) => s.id !== reviewedId));
    } catch (err) {
      setResolveError(err instanceof ApiError ? err.detail : 'No se pudo guardar la decisión. Intentá de nuevo.');
      // 409: otro admin ya la revisó -- la cola quedó desactualizada.
      if (err instanceof ApiError && err.status === 409) load();
    } finally {
      setResolving(false);
    }
  }

  const noDocs = pending ? pending.spot.verificationPhotos.length === 0 : false;

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader
          title="Cocheras nuevas"
          subtitle="Cocheras que los dueños acaban de crear y todavía no aparecen en las búsquedas. Revisá la documentación antes de aprobarlas."
        />

        {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && spots.length === 0 ? (
          <Text style={styles.hint}>No hay cocheras pendientes de revisión.</Text>
        ) : null}

        <FlatList
          data={spots}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.caption}>Creada {formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.address}>{item.address}</Text>
              <Text style={styles.caption}>Dueño: {ownerNames[item.ownerId] ?? item.ownerId}</Text>
              <Text style={styles.caption}>
                {priceSummary(item)} · {item.covered ? 'Techada' : 'Descubierta'} · {item.vehicleTypes.join(', ') || '—'} · Capacidad {item.capacity}
              </Text>

              <Text style={styles.sectionLabel}>
                Documentación ({item.verificationPhotos.length})
              </Text>
              {item.verificationPhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
                  {item.verificationPhotos.map((url) => (
                    <Pressable key={url} onPress={() => Linking.openURL(url)} style={CURSOR_POINTER}>
                      <Image source={{ uri: url }} style={styles.photo} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.warning}>El dueño todavía no subió documentación.</Text>
              )}

              <View style={styles.actions}>
                <Pressable
                  onPress={() => router.push(`/(admin)/spots/${item.id}`)}
                  style={({ hovered }: PressableState) => [styles.linkBtn, hovered && styles.linkBtnHovered, CURSOR_POINTER]}
                >
                  <Text style={styles.linkBtnText}>Ver detalle</Text>
                </Pressable>
                <Button title="Rechazar" variant="danger" onPress={() => askDecision(item, 'rejected')} />
                <Button title="Aprobar y publicar" onPress={() => askDecision(item, 'approved')} />
              </View>
            </Card>
          )}
        />
      </View>

      <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{rejecting ? 'Rechazar cochera' : 'Aprobar y publicar'}</Text>
                <Text style={styles.modalBody}>
                  {rejecting
                    ? 'La cochera no se publica y el dueño ve el motivo en la app. No se puede reabrir: tendría que crearla de nuevo.'
                    : 'La cochera pasa a estar activa y empieza a aparecer en las búsquedas.'}
                </Text>
                {!rejecting && noDocs ? (
                  <Text style={styles.warning}>Ojo: esta cochera no tiene documentación cargada.</Text>
                ) : null}
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  editable={!resolving}
                  placeholder={rejecting ? 'Motivo del rechazo (obligatorio)' : 'Comentario para el dueño (opcional)'}
                  placeholderTextColor={colors.textSecondary}
                />
                {rejecting && trimmedNotes.length < MIN_REJECTION_NOTES ? (
                  <Text style={styles.caption}>Escribí al menos {MIN_REJECTION_NOTES} caracteres explicando el motivo.</Text>
                ) : null}
                {resolveError ? <Text style={styles.error}>{resolveError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalCancelBtn, hovered && styles.modalCancelBtnHovered, CURSOR_POINTER]}
                    onPress={closeModal}
                    disabled={resolving}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Button
                    title="Confirmar"
                    variant={rejecting ? 'danger' : 'primary'}
                    onPress={confirmDecision}
                    loading={resolving}
                    disabled={!canConfirm}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },
  warning: { color: colors.warning, fontSize: 13, fontWeight: '600', marginTop: 4 },

  list: { paddingVertical: 12, gap: 12 },
  card: { gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  address: { fontSize: 14, color: colors.text },
  caption: { fontSize: 13, color: colors.textSecondary },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  gallery: { flexGrow: 0, marginTop: 4 },
  photo: { width: 150, height: 110, borderRadius: 10, marginRight: 8, backgroundColor: colors.background },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  linkBtnHovered: { backgroundColor: colors.background },
  linkBtnText: { color: colors.teal, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  notesInput: {
    minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10,
    fontSize: 14, color: colors.text, textAlignVertical: 'top', marginTop: 4,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalCancelBtnHovered: { backgroundColor: colors.background },
  modalCancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
