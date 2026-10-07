import { useState } from 'react';
import { View, Text, TextInput, Modal, Pressable, StyleSheet, ActivityIndicator, TouchableWithoutFeedback, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import {
  deleteUserAtHoldersRequest,
  getAccountClosureSummary,
  reactivateUser,
  suspendUser,
} from '@/src/api/admin';
import { ApiError } from '@/src/api/client';
import { AccountClosureSummary, AdminUserDetail } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
type Action = 'suspend' | 'reactivate' | 'delete';

const MIN_REASON = 3;
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

const ACTION_COPY: Record<Action, { title: string; body: string; confirm: string }> = {
  suspend: {
    title: 'Suspender cuenta',
    body:
      'El usuario no va a poder iniciar sesión, sus cocheras dejan de aparecer en las búsquedas y se ' +
      'cancelan con reembolso total las reservas que todavía no empezaron. Al intentar entrar se le pide ' +
      'que escriba a soporte. Solo un admin la puede reactivar.',
    confirm: 'Suspender',
  },
  reactivate: {
    title: 'Reactivar cuenta',
    body: 'El usuario vuelve a poder iniciar sesión y sus cocheras vuelven a estar publicadas. Las reservas que se cancelaron siguen canceladas.',
    confirm: 'Reactivar',
  },
  delete: {
    title: 'Eliminar cuenta a pedido del titular',
    body:
      'Usalo solo si el titular pidió eliminar su cuenta fuera de la app (por mail, por ejemplo). Se borran ' +
      'sus datos personales en el momento, o apenas se le termine de pagar lo que se le debe. Las reservas ' +
      'y pagos quedan, sin datos que lo identifiquen. No se puede deshacer.',
    confirm: 'Eliminar cuenta',
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function consequences(summary: AccountClosureSummary): string[] {
  const lines: string[] = [];
  const ownerCount = summary.ownerBookingsToCancel + summary.ownerRequestsToReject;
  if (summary.spotCount > 0) lines.push(`Se pausan sus ${summary.spotCount} cocheras.`);
  if (summary.driverBookingsToCancel > 0) lines.push(`Se cancelan ${summary.driverBookingsToCancel} reservas suyas como conductor, con reembolso total.`);
  if (ownerCount > 0) lines.push(`Se cancelan ${ownerCount} reservas o solicitudes en sus cocheras, con reembolso total a los conductores.`);
  if (summary.pendingPayoutCount > 0) {
    lines.push(`Se le deben ${formatCentavos(summary.pendingPayoutAmount)} (${summary.pendingPayoutCount} pagos): hay que liquidárselos antes de borrar sus datos de cobro.`);
  }
  if (lines.length === 0) lines.push('No tiene cocheras, reservas pendientes ni pagos por cobrar.');
  return lines;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'primary' | 'warning' | 'danger';

// The pill and the details box share the status' color: green while active, amber while
// suspended, red while being deleted, grey once deleted (only reachable from old bookings
// or settlements -- the data is already gone).
const STATUS_STYLE: Record<AdminUserDetail['status'], { label: string; color: string; background: string; border: string }> = {
  ACTIVE: { label: 'Activa', color: colors.success, background: '#F0FDF4', border: '#BBF7D0' },
  SUSPENDED: { label: 'Suspendida', color: colors.warning, background: '#FFFBEB', border: '#FDE68A' },
  PENDING_DELETION: { label: 'Eliminándose', color: colors.danger, background: '#FEF2F2', border: '#FECACA' },
  DELETED: { label: 'Eliminada', color: colors.textSecondary, background: '#F8FAFC', border: colors.border },
};

const TONE_COLOR: Record<Tone, string> = {
  primary: colors.teal,
  warning: colors.warning,
  danger: colors.danger,
};

// Compact outlined action, sized for a detail card rather than a primary call to action.
function SmallButton({ icon, label, tone, onPress }: { icon: IconName; label: string; tone: Tone; onPress: () => void }) {
  const color = TONE_COLOR[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: PressableState) => [
        styles.smallButton,
        { borderColor: color },
        hovered && { backgroundColor: `${color}14` },
        CURSOR_POINTER,
      ]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.smallButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Account status plus the admin actions on it: suspend, reactivate (the only way out of a
 * suspension), and delete at the holder's request. */
export function AccountStatusCard({ user, onChange }: { user: AdminUserDetail; onChange: (user: AdminUserDetail) => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const [summary, setSummary] = useState<AccountClosureSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminDeletion = user.status === 'PENDING_DELETION' && user.deletionRequestedByAdminId !== null;
  const canSuspend = user.status === 'ACTIVE' || (user.status === 'PENDING_DELETION' && !adminDeletion);
  const canReactivate = user.status === 'SUSPENDED';
  const canDelete = user.status !== 'DELETED' && !adminDeletion;

  function open(next: Action) {
    setAction(next);
    setReason('');
    setError(null);
    setSummary(null);
    setSummaryError(null);
    if (next !== 'reactivate') {
      getAccountClosureSummary(user.id)
        .then(setSummary)
        .catch((err) => setSummaryError(err instanceof ApiError ? err.detail : 'No se pudo cargar qué implica.'));
    }
  }

  function close() {
    if (!busy) setAction(null);
  }

  async function confirm() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = reason.trim();
      const updated =
        action === 'suspend'
          ? await suspendUser(user.id, trimmed)
          : action === 'reactivate'
            ? await reactivateUser(user.id)
            : await deleteUserAtHoldersRequest(user.id, trimmed);
      onChange(updated);
      setAction(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }

  const needsReason = action === 'suspend' || action === 'delete';
  const needsSummary = action === 'suspend' || action === 'delete';
  const blocked = needsSummary && summary?.blocked;
  const canConfirm =
    !busy && (!needsReason || reason.trim().length >= MIN_REASON) && (!needsSummary || (summary !== null && !summary.blocked));

  const status = STATUS_STYLE[user.status];
  const details: { icon: IconName; text: string }[] = [];
  if (user.status === 'ACTIVE') {
    details.push({ icon: 'checkmark-circle-outline', text: 'Puede iniciar sesión, reservar y publicar cocheras con normalidad.' });
  }
  if (user.status === 'SUSPENDED') {
    if (user.suspendedAt) details.push({ icon: 'calendar-outline', text: `Suspendida el ${formatDate(user.suspendedAt)}` });
    if (user.suspensionReason) details.push({ icon: 'chatbox-ellipses-outline', text: user.suspensionReason });
  }
  if (user.status === 'PENDING_DELETION') {
    if (adminDeletion) {
      details.push({ icon: 'cash-outline', text: 'Se borran sus datos apenas se le termine de pagar lo que se le debe.' });
      if (user.deletionReason) details.push({ icon: 'chatbox-ellipses-outline', text: user.deletionReason });
    } else {
      details.push({
        icon: 'calendar-outline',
        text: `Pidió eliminar su cuenta. Se elimina el ${user.deletionScheduledAt ? formatDate(user.deletionScheduledAt) : '—'}.`,
      });
      details.push({ icon: 'arrow-undo-outline', text: 'Hasta entonces puede cancelarlo desde la app.' });
    }
  }
  if (user.status === 'DELETED') {
    if (user.deletedAt) details.push({ icon: 'calendar-outline', text: `Eliminada el ${formatDate(user.deletedAt)}` });
    details.push({ icon: 'shield-checkmark-outline', text: 'Sus datos personales ya se borraron.' });
    if (user.deletionReason) details.push({ icon: 'chatbox-ellipses-outline', text: user.deletionReason });
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Estado de la cuenta</Text>
        <View style={[styles.pill, { backgroundColor: status.background, borderColor: status.border }]}>
          <View style={[styles.dot, { backgroundColor: status.color }]} />
          <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={[styles.details, { backgroundColor: status.background, borderColor: status.border }]}>
        {details.map((detail) => (
          <View key={detail.text} style={styles.detailRow}>
            <Ionicons name={detail.icon} size={15} color={status.color} />
            <Text style={styles.detailText}>{detail.text}</Text>
          </View>
        ))}
      </View>

      {canSuspend || canReactivate || canDelete ? (
        <View style={styles.actions}>
          {canReactivate ? <SmallButton icon="play-circle-outline" label="Reactivar cuenta" tone="primary" onPress={() => open('reactivate')} /> : null}
          {canSuspend ? <SmallButton icon="pause-circle-outline" label="Suspender" tone="warning" onPress={() => open('suspend')} /> : null}
          {canDelete ? <SmallButton icon="trash-outline" label="Eliminar a pedido del titular" tone="danger" onPress={() => open('delete')} /> : null}
        </View>
      ) : null}

      <Modal visible={action !== null} transparent animationType="fade" onRequestClose={close}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                {action ? (
                  <>
                    <Text style={styles.modalTitle}>{ACTION_COPY[action].title}</Text>
                    <Text style={styles.modalBody}>{ACTION_COPY[action].body}</Text>

                    {needsSummary ? (
                      summaryError ? (
                        <Text style={styles.error}>{summaryError}</Text>
                      ) : !summary ? (
                        <ActivityIndicator color={colors.teal} />
                      ) : blocked ? (
                        <Text style={styles.error}>
                          Tiene una reserva en curso. Vas a poder hacerlo cuando termine.
                        </Text>
                      ) : (
                        <View style={styles.consequences}>
                          {consequences(summary).map((line) => (
                            <Text key={line} style={styles.consequence}>• {line}</Text>
                          ))}
                        </View>
                      )
                    ) : null}

                    {needsReason ? (
                      <>
                        <TextInput
                          style={styles.input}
                          value={reason}
                          onChangeText={setReason}
                          multiline
                          editable={!busy}
                          placeholder={action === 'delete' ? 'Cómo y cuándo lo pidió el titular (obligatorio)' : 'Motivo de la suspensión (obligatorio)'}
                          placeholderTextColor={colors.textSecondary}
                        />
                        {reason.trim().length < MIN_REASON ? (
                          <Text style={styles.caption}>Queda registrado en la cuenta junto con tu usuario.</Text>
                        ) : null}
                      </>
                    ) : null}

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <View style={styles.modalActions}>
                      <Pressable
                        style={({ hovered }: PressableState) => [styles.cancelBtn, hovered && styles.cancelBtnHovered, CURSOR_POINTER]}
                        onPress={close}
                        disabled={busy}
                      >
                        <Text style={styles.cancelBtnText}>Cancelar</Text>
                      </Pressable>
                      <Button
                        title={ACTION_COPY[action].confirm}
                        variant={action === 'reactivate' ? 'primary' : 'danger'}
                        onPress={confirm}
                        loading={busy}
                        disabled={!canConfirm}
                      />
                    </View>
                  </>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  details: { gap: 6, marginTop: 12, borderRadius: 10, padding: 12, borderWidth: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  smallButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, backgroundColor: colors.surface,
  },
  smallButtonText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  consequences: { gap: 4, backgroundColor: colors.background, borderRadius: 10, padding: 12 },
  consequence: { fontSize: 13, color: colors.text, lineHeight: 19 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, minHeight: 70,
    fontSize: 14, color: colors.text, textAlignVertical: 'top',
  },
  caption: { fontSize: 12, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelBtnHovered: { backgroundColor: colors.background },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
