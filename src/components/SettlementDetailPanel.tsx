import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { SettlementStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getSettlement, getUserDetail, getAdminAccount, getPayoutInfoHistory, confirmSettlement, cancelSettlement, ProofAsset } from '@/src/api/admin';
import { AdminUserDetail, PayoutInfoChange, Settlement } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { formatShortDateTime } from '@/src/services/dates';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return formatShortDateTime(iso);
}

function displayName(u: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

// A proof can be a photo of the transfer confirmation or a PDF receipt -- only the former
// renders as an inline preview image. Checked by extension since that's all a presigned R2
// URL's query string leaves readable (it's appended after the real path).
// A change of the bank account (or its holder) this recent before paying is worth a second
// look: a hijacked account changes the CBU first and then waits for the payout.
const RECENT_PAYOUT_CHANGE_DAYS = 14;

function recentPayoutChange(history: PayoutInfoChange[]): PayoutInfoChange | null {
  const since = Date.now() - RECENT_PAYOUT_CHANGE_DAYS * 24 * 60 * 60 * 1000;
  return (
    history.find(
      (c) =>
        new Date(c.changedAt).getTime() >= since &&
        ((c.previousCbu !== null && c.previousCbu !== c.cbu) || (c.previousTitular !== null && c.previousTitular !== c.titular)),
    ) ?? null
  );
}

function isImageProof(nameOrUrl: string): boolean {
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(nameOrUrl.split('?')[0]);
}

interface SettlementDetailPanelProps {
  settlementId: string;
  /** Called after a successful confirm, e.g. so a list pane can refresh. */
  onConfirmed?: (settlement: Settlement) => void;
  /** Called after a successful cancel -- the settlement no longer exists, so callers
   *  should navigate away or drop it from a list rather than try to re-render it. */
  onCancelled?: (settlementId: string) => void;
}

// The full "Detalle de liquidación" view -- shared between the standalone route
// (app/(admin)/settlements/[id].tsx, used on narrow windows / direct links) and the
// desktop two-pane master-detail layout (app/(admin)/settlements/index.tsx). Structurally
// mirrors the old PayoutDetailPanel this replaces, but built around a batched Settlement
// (confirm/cancel) instead of a single Payout (mark-paid).
export function SettlementDetailPanel({ settlementId, onConfirmed, onCancelled }: SettlementDetailPanelProps) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [owner, setOwner] = useState<AdminUserDetail | null>(null);
  const [payoutChange, setPayoutChange] = useState<PayoutInfoChange | null>(null);
  const [adminUsernames, setAdminUsernames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proof, setProof] = useState<ProofAsset | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProof(null);
    setSubmitError(null);
    setCancelError(null);
    setOwner(null);
    setPayoutChange(null);
    setAdminUsernames({});
    getSettlement(settlementId)
      .then(async (s) => {
        if (cancelled) return;
        setSettlement(s);
        try {
          const ownerDetail = await getUserDetail(s.ownerId);
          if (!cancelled) setOwner(ownerDetail);
        } catch {
          // No datos de cobro to show if this fails -- not fatal to the rest of the panel.
        }
        getPayoutInfoHistory(s.ownerId)
          .then((history) => !cancelled && setPayoutChange(recentPayoutChange(history)))
          .catch(() => {});
        // "Creado por"/"Pagado por" show a username, not a raw admin id -- resolve
        // whichever of the two admin ids this settlement actually has.
        const adminIds = [...new Set([s.createdByAdminId, s.paidByAdminId].filter((id): id is string => !!id))];
        const resolved = await Promise.allSettled(adminIds.map((id) => getAdminAccount(id)));
        if (cancelled) return;
        const usernames: Record<string, string> = {};
        resolved.forEach((result, i) => {
          if (result.status === 'fulfilled') usernames[adminIds[i]] = result.value.username;
        });
        setAdminUsernames(usernames);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : 'No se pudo cargar la liquidación.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settlementId]);

  async function pickProof() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setProof({
      uri: asset.uri,
      name: asset.name ?? 'comprobante',
      type: asset.mimeType ?? 'application/octet-stream',
    });
  }

  async function confirmPayment() {
    if (!settlement) return;
    setConfirmVisible(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await confirmSettlement(settlement.id, proof ?? undefined);
      setSettlement(updated);
      setSuccessVisible(true);
      onConfirmed?.(updated);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : 'No se pudo confirmar el pago.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCancel() {
    if (!settlement) return;
    setCancelVisible(false);
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelSettlement(settlement.id);
      onCancelled?.(settlement.id);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.detail : 'No se pudo cancelar la liquidación.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (error || !settlement) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Liquidación no encontrada.'}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Liquidación #{settlement.id.slice(0, 8)}</Text>
            <SettlementStatusBadge status={settlement.status} />
          </View>

          <DataRow label="Bruto" value={formatCentavos(settlement.grossAmount)} />
          <DataRow label="Comisión" value={`- ${formatCentavos(settlement.commissionAmount)}`} />
          <View style={styles.divider} />
          <DataRow label="Neto a pagar" value={formatCentavos(settlement.netAmount)} emphasize />

          <View style={styles.divider} />
          <Pressable
            onPress={() => router.push(`/(admin)/users/${settlement.ownerId}`)}
            style={({ hovered }: PressableState) => [hovered && styles.linkRowHovered, CURSOR_POINTER]}
          >
            <DataRow label="Dueño" value={owner ? displayName(owner) : settlement.ownerId} link />
          </Pressable>
          <DataRow label="Creado" value={formatDate(settlement.createdAt)} />
          <DataRow label="Creado por" value={adminUsernames[settlement.createdByAdminId] ?? settlement.createdByAdminId} />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Datos de cobro</Text>
          {payoutChange && settlement.status === 'PENDING' ? (
            <View style={styles.cbuWarning}>
              <Text style={styles.cbuWarningTitle}>Los datos de cobro cambiaron el {formatDate(payoutChange.changedAt)}</Text>
              <Text style={styles.cbuWarningText}>
                Antes: {payoutChange.previousCbu ?? '-'} ({payoutChange.previousTitular ?? 'sin titular'}). Confirmá con el dueño por otro
                medio que el cambio lo hizo él antes de transferir.
              </Text>
            </View>
          ) : null}
          {owner?.hasPayoutInfo ? (
            <>
              <DataRow label="CBU" value={owner.cbu ?? '-'} />
              <DataRow label="Titular" value={owner.payoutTitular ?? '-'} />
              <DataRow label="CUIL" value={owner.cuil ?? '-'} />
            </>
          ) : (
            <Text style={styles.hint}>
              {owner ? 'Este dueño todavía no cargó sus datos de cobro.' : 'No se pudieron cargar los datos de cobro.'}
            </Text>
          )}
        </Card>

        {settlement.payouts && settlement.payouts.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>Reservas incluidas ({settlement.payouts.length})</Text>
            {settlement.payouts.map((p) => (
              <View key={p.id} style={styles.payoutRow}>
                <Text style={styles.payoutBooking}>
                  Reserva: {p.bookingId}{p.kind === 'OVERSTAY' ? ' · exceso de tiempo' : ''}
                </Text>
                <Text style={styles.payoutAmount}>{formatCentavos(p.netAmount)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {settlement.status === 'PAID' ? (
          <Card>
            <Text style={styles.sectionTitle}>Detalle del pago</Text>
            {settlement.paidAt ? <DataRow label="Pagado el" value={formatDate(settlement.paidAt)} /> : null}
            {settlement.paidByAdminId ? (
              <DataRow label="Pagado por" value={adminUsernames[settlement.paidByAdminId] ?? settlement.paidByAdminId} />
            ) : null}
            {settlement.proofUrl ? (
              <Button
                title="Ver comprobante"
                variant="secondary"
                onPress={() => Linking.openURL(settlement.proofUrl!)}
                style={styles.attachBtn}
              />
            ) : (
              <Text style={styles.hint}>No se adjuntó comprobante.</Text>
            )}
          </Card>
        ) : (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Confirmar pago</Text>
              <Text style={styles.hint}>
                Adjuntá el comprobante de la transferencia (foto o PDF, opcional) y confirmá que el pago se realizó.
              </Text>
              {proof ? (
                isImageProof(proof.name) ? (
                  <Image source={{ uri: proof.uri }} style={styles.proofImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.hint}>Archivo adjunto: {proof.name}</Text>
                )
              ) : null}
              <Button
                title={proof ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
                variant="secondary"
                onPress={pickProof}
                style={styles.attachBtn}
              />
              {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
              <Button title="Confirmar pago" onPress={() => setConfirmVisible(true)} loading={submitting} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Cancelar liquidación</Text>
              <Text style={styles.hint}>
                Deshace este borrador y libera sus pagos, que vuelven a aparecer en "Saldos pendientes".
              </Text>
              {cancelError ? <Text style={styles.error}>{cancelError}</Text> : null}
              <Button
                title="Cancelar liquidación"
                variant="danger"
                onPress={() => setCancelVisible(true)}
                loading={cancelling}
              />
            </Card>
          </>
        )}
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setConfirmVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Confirmar pago</Text>
                <Text style={styles.modalBody}>
                  Vas a marcar esta liquidación de {formatCentavos(settlement.netAmount)} como pagada. Esta acción no
                  se puede deshacer.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalCancelBtn, hovered && styles.modalCancelBtnHovered, CURSOR_POINTER]}
                    onPress={() => setConfirmVisible(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>Volver</Text>
                  </Pressable>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalConfirmBtn, hovered && styles.modalConfirmBtnHovered, CURSOR_POINTER]}
                    onPress={confirmPayment}
                  >
                    <Text style={styles.modalConfirmBtnText}>Confirmar</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={cancelVisible} transparent animationType="fade" onRequestClose={() => setCancelVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setCancelVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Cancelar liquidación</Text>
                <Text style={styles.modalBody}>
                  Esta liquidación de {formatCentavos(settlement.netAmount)} se va a eliminar y sus pagos vuelven a
                  quedar pendientes sin liquidar. Esta acción no se puede deshacer.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalCancelBtn, hovered && styles.modalCancelBtnHovered, CURSOR_POINTER]}
                    onPress={() => setCancelVisible(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>Volver</Text>
                  </Pressable>
                  <Button title="Sí, cancelar" variant="danger" onPress={confirmCancel} loading={cancelling} />
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
                <Text style={styles.modalBody}>La liquidación se marcó como pagada correctamente.</Text>
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
  cbuWarning: { borderWidth: 1, borderColor: colors.warning, backgroundColor: '#FFF7E6', borderRadius: 8, padding: 10, gap: 4, marginBottom: 8 },
  cbuWarningTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  cbuWarningText: { fontSize: 12, color: colors.text, lineHeight: 18 },
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
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  payoutBooking: { fontSize: 13, fontWeight: '600', color: colors.text },
  payoutAmount: { fontSize: 13, fontWeight: '700', color: colors.text },
  proofImage: { width: '100%', height: 220, borderRadius: 10, marginBottom: 10, backgroundColor: colors.background },
  attachBtn: { marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalCancelBtnHovered: { backgroundColor: colors.background },
  modalCancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  modalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.teal },
  modalConfirmBtnHovered: { backgroundColor: '#137274' },
  modalConfirmBtnText: { color: colors.white, fontWeight: '700' },
});
