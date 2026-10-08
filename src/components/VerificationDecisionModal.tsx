import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TouchableWithoutFeedback, ViewStyle } from 'react-native';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { resolveVerificationReview } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { VerificationReviewDecision } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

export interface PendingVerificationDecision {
  bookingId: string;
  /** What the driver paid, in centavos -- what a refund gives back. */
  amount: number;
  decision: VerificationReviewDecision;
}

/**
 * Confirms an admin's decision on a booking that completed without its arrival code being
 * verified -- approve the owner's payout, or refund the driver. Shared by the "Sin
 * verificar" list and the booking's detail page, so both decide exactly the same way.
 */
export function VerificationDecisionModal({
  pending,
  onClose,
  onResolved,
}: {
  pending: PendingVerificationDecision | null;
  onClose: () => void;
  onResolved: (bookingId: string, decision: VerificationReviewDecision) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (resolving) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!pending) return;
    setResolving(true);
    setError(null);
    try {
      await resolveVerificationReview(pending.bookingId, pending.decision);
      onResolved(pending.bookingId, pending.decision);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar la decisión. Intentá de nuevo.');
    } finally {
      setResolving(false);
    }
  }

  const refund = pending?.decision === 'REFUNDED';
  return (
    <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <Text style={styles.title}>{refund ? 'Reembolsar al conductor' : 'Aprobar pago al dueño'}</Text>
              <Text style={styles.body}>
                {refund
                  ? `Se le devuelven ${pending ? formatCentavos(pending.amount) : ''} al conductor por Mercado Pago y el dueño no cobra esta reserva. No se puede deshacer.`
                  : 'La reserva se da por cumplida y el pago al dueño entra en su próxima liquidación. No se puede deshacer.'}
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  style={({ hovered }: PressableState) => [styles.cancelBtn, hovered && styles.cancelBtnHovered, CURSOR_POINTER]}
                  onPress={close}
                  disabled={resolving}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Button title="Confirmar" variant={refund ? 'danger' : 'primary'} onPress={confirm} loading={resolving} />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelBtnHovered: { backgroundColor: colors.background },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
