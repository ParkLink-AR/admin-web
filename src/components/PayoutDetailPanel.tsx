import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { PayoutStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getPayout, markPayoutPaid, ProofAsset } from '@/src/api/admin';
import { Payout } from '@/src/types';
import { ApiError } from '@/src/api/client';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PayoutDetailPanelProps {
  payoutId: string;
  /** Called after a successful mark-paid, e.g. so a list pane can refresh. */
  onChanged?: (payout: Payout) => void;
}

// The full "Detalle de pago" view -- shared between the standalone route
// (app/(admin)/payouts/[id].tsx, used on narrow windows / direct links) and
// the desktop two-pane master-detail layout (app/(admin)/payouts/index.tsx),
// so the mark-paid flow only lives in one place.
export function PayoutDetailPanel({ payoutId, onChanged }: PayoutDetailPanelProps) {
  const [payout, setPayout] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proof, setProof] = useState<ProofAsset | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProof(null);
    setSubmitError(null);
    getPayout(payoutId)
      .then((p) => {
        if (!cancelled) setPayout(p);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el pago.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payoutId]);

  async function pickProof() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSubmitError('Se necesita acceso a la galería para adjuntar el comprobante.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setProof({
      uri: asset.uri,
      name: asset.fileName ?? 'comprobante.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
  }

  async function confirmMarkPaid() {
    if (!payout) return;
    setConfirmVisible(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await markPayoutPaid(payout.id, proof ?? undefined);
      setPayout(updated);
      setSuccessVisible(true);
      onChanged?.(updated);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : 'No se pudo marcar el pago como pagado.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (error || !payout) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Pago no encontrado.'}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Pago #{payout.id.slice(0, 8)}</Text>
            <PayoutStatusBadge status={payout.status} />
          </View>

          <DataRow label="Bruto" value={formatCentavos(payout.grossAmount)} />
          <DataRow label="Comisión" value={`- ${formatCentavos(payout.commissionAmount)}`} />
          <View style={styles.divider} />
          <DataRow label="Neto a pagar" value={formatCentavos(payout.netAmount)} emphasize />

          <View style={styles.divider} />
          <DataRow label="Reserva" value={payout.bookingId} />
          <Pressable
            onPress={() => router.push(`/(admin)/users/${payout.ownerId}`)}
            style={({ hovered }: PressableState) => [hovered && styles.linkRowHovered, CURSOR_POINTER]}
          >
            <DataRow label="Dueño" value={payout.ownerId} link />
          </Pressable>
          <DataRow label="Creado" value={formatDate(payout.createdAt)} />
        </Card>

        {payout.status === 'PAID' ? (
          <Card>
            <Text style={styles.sectionTitle}>Detalle del pago</Text>
            {payout.paidAt ? <DataRow label="Pagado el" value={formatDate(payout.paidAt)} /> : null}
            {payout.paidByAdminId ? <DataRow label="Pagado por" value={payout.paidByAdminId} /> : null}
            {payout.proofUrl ? (
              <Image source={{ uri: payout.proofUrl }} style={styles.proofImage} resizeMode="contain" />
            ) : (
              <Text style={styles.hint}>No se adjuntó comprobante.</Text>
            )}
          </Card>
        ) : (
          <Card>
            <Text style={styles.sectionTitle}>Marcar como pagado</Text>
            <Text style={styles.hint}>
              Adjuntá una foto del comprobante de la transferencia (opcional) y confirmá el pago.
            </Text>
            {proof ? <Image source={{ uri: proof.uri }} style={styles.proofImage} resizeMode="contain" /> : null}
            <Button
              title={proof ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
              variant="secondary"
              onPress={pickProof}
              style={styles.attachBtn}
            />
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            <Button title="Marcar como pagado" onPress={() => setConfirmVisible(true)} loading={submitting} />
          </Card>
        )}
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setConfirmVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Confirmar pago</Text>
                <Text style={styles.modalBody}>
                  Vas a marcar este pago de {formatCentavos(payout.netAmount)} como pagado. Esta acción no se puede
                  deshacer.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalCancelBtn, hovered && styles.modalCancelBtnHovered, CURSOR_POINTER]}
                    onPress={() => setConfirmVisible(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalConfirmBtn, hovered && styles.modalConfirmBtnHovered, CURSOR_POINTER]}
                    onPress={confirmMarkPaid}
                  >
                    <Text style={styles.modalConfirmBtnText}>Confirmar</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setSuccessVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Pago realizado</Text>
                <Text style={styles.modalBody}>El pago se marcó como pagado correctamente.</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalConfirmBtn, hovered && styles.modalConfirmBtnHovered, CURSOR_POINTER]}
                    onPress={() => setSuccessVisible(false)}
                  >
                    <Text style={styles.modalConfirmBtnText}>Listo</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

function DataRow({ label, value, emphasize, link }: { label: string; value: string; emphasize?: boolean; link?: boolean }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, emphasize && styles.dataValueEmphasize, link && styles.dataValueLink]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 8 },
  body: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 },
  dataLabel: { fontSize: 13, color: colors.textSecondary },
  dataValue: { fontSize: 13, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  dataValueEmphasize: { fontSize: 16, fontWeight: '700' },
  dataValueLink: { color: colors.teal, textDecorationLine: 'underline' },
  linkRowHovered: { backgroundColor: colors.background, borderRadius: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  proofImage: { width: '100%', height: 220, borderRadius: 10, marginBottom: 10, backgroundColor: colors.background },
  attachBtn: { marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalCancelBtnHovered: { backgroundColor: colors.background },
  modalCancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  modalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.teal },
  modalConfirmBtnHovered: { backgroundColor: '#137274' },
  modalConfirmBtnText: { color: colors.white, fontWeight: '700' },
});
