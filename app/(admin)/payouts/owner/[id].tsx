import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { PageHeader } from '@/src/components/PageHeader';
import { colors } from '@/src/theme/colors';
import { formatCentavos } from '@/src/services/money';
import { getUserDetail, getOwnerPendingPayouts, draftSettlement } from '@/src/api/admin';
import { AdminUserDetail, Payout } from '@/src/types';
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

function displayName(u: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

// Reviewing one owner's unattached pending payouts before batching them into a
// Settlement -- reached from payouts/index.tsx's "Saldos pendientes" list. "Preparar
// liquidación" (draftSettlement) freezes every payout shown here into a new PENDING
// Settlement and this screen hands off to its detail screen (settlements/[id].tsx) so
// the admin immediately sees the frozen draft and can confirm or cancel it.
export default function OwnerPendingBalanceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [owner, setOwner] = useState<AdminUserDetail | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [nothingToSettle, setNothingToSettle] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [ownerDetail, ownerPayouts] = await Promise.all([getUserDetail(id), getOwnerPendingPayouts(id)]);
        if (cancelled) return;
        setOwner(ownerDetail);
        setPayouts(ownerPayouts);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el saldo del dueño.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function confirmDraft() {
    if (!id) return;
    setConfirmVisible(false);
    setDrafting(true);
    setDraftError(null);
    try {
      const settlement = await draftSettlement(id);
      router.replace(`/(admin)/settlements/${settlement.id}`);
    } catch (err) {
      // 400 NOTHING_TO_SETTLE is the only documented failure mode here -- it means
      // another admin drafted (or the owner otherwise lost) every pending payout in the
      // instant between this screen loading and the button being pressed.
      if (err instanceof ApiError && err.status === 400) {
        setNothingToSettle(true);
      } else {
        setDraftError(err instanceof ApiError ? err.detail : 'No se pudo preparar la liquidación.');
      }
    } finally {
      setDrafting(false);
    }
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (error || !owner) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Dueño no encontrado.'}</Text>
      </Screen>
    );
  }

  const total = payouts.reduce((sum, p) => sum + p.netAmount, 0);

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title="Preparar liquidación" showBack />

        <Card>
          <Pressable
            onPress={() => router.push(`/(admin)/users/${owner.id}`)}
            style={({ hovered }: PressableState) => [hovered && styles.linkRowHovered, CURSOR_POINTER]}
          >
            <Text style={styles.ownerLabel}>Dueño</Text>
            <Text style={styles.ownerName}>{displayName(owner)}</Text>
            <Text style={styles.caption}>{owner.email}</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Reservas pendientes ({payouts.length})</Text>
          {payouts.length === 0 ? (
            <Text style={styles.hint}>Este dueño ya no tiene pagos pendientes.</Text>
          ) : (
            payouts.map((p) => (
              <View key={p.id} style={styles.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutBooking}>Reserva: {p.bookingId}</Text>
                  <Text style={styles.caption}>Creado: {formatDate(p.createdAt)}</Text>
                </View>
                <Text style={styles.payoutAmount}>{formatCentavos(p.netAmount)}</Text>
              </View>
            ))
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total neto a liquidar</Text>
            <Text style={styles.totalValue}>{formatCentavos(total)}</Text>
          </View>
        </Card>

        {draftError ? <Text style={styles.error}>{draftError}</Text> : null}

        <Button
          title="Preparar liquidación"
          onPress={() => setConfirmVisible(true)}
          loading={drafting}
          disabled={payouts.length === 0}
        />
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setConfirmVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Preparar liquidación</Text>
                <Text style={styles.modalBody}>
                  Se va a congelar {payouts.length === 1 ? 'el pago pendiente' : `los ${payouts.length} pagos pendientes`}{' '}
                  de {displayName(owner)} ({formatCentavos(total)}) en una liquidación nueva. Vas a poder confirmarla o
                  cancelarla desde la siguiente pantalla.
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
                    onPress={confirmDraft}
                  >
                    <Text style={styles.modalConfirmBtnText}>Confirmar</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={nothingToSettle} transparent animationType="fade" onRequestClose={() => setNothingToSettle(false)}>
        <TouchableWithoutFeedback onPress={() => setNothingToSettle(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Nada para liquidar</Text>
                <Text style={styles.modalBody}>
                  Este dueño ya no tiene pagos pendientes sin liquidar -- es posible que otro administrador ya haya
                  preparado la liquidación. Volvés a la lista de saldos pendientes.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [styles.modalConfirmBtn, hovered && styles.modalConfirmBtnHovered, CURSOR_POINTER]}
                    onPress={() => {
                      setNothingToSettle(false);
                      router.back();
                    }}
                  >
                    <Text style={styles.modalConfirmBtnText}>Entendido</Text>
                  </Pressable>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 8 },
  body: { padding: 24, gap: 14, maxWidth: 800, width: '100%', alignSelf: 'center' },

  linkRowHovered: { backgroundColor: colors.background, borderRadius: 6 },
  ownerLabel: { fontSize: 12, color: colors.textSecondary },
  ownerName: { fontSize: 17, fontWeight: '700', color: colors.teal, marginTop: 2 },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.textSecondary },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
  payoutBooking: { fontSize: 13, fontWeight: '600', color: colors.text },
  payoutAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  totalValue: { fontSize: 19, fontWeight: '700', color: colors.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, gap: 8 },
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
