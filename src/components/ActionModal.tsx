import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, TouchableWithoutFeedback, ViewStyle } from 'react-native';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { ApiError } from '@/src/api/client';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

export interface ActionModalConfig {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'primary' | 'danger';
  /** The reason/note field: required unless `noteOptional`. */
  notePlaceholder?: string;
  noteOptional?: boolean;
  /** An amount in pesos (e.g. how much to refund), prefilled with `defaultAmount`. */
  amount?: { label: string; max: number; defaultAmount?: number };
  /** A date and time in Buenos Aires ("2026-10-12 20:30"), prefilled with `defaultValue`. */
  dateTime?: { label: string; defaultValue: string };
  /** Runs the action; throwing shows the error and keeps the modal open. */
  onConfirm: (note: string, amountPesos: number | null, dateTime: string | null) => Promise<void>;
}

/**
 * The confirmation every admin action that changes something goes through: what it does, a
 * reason (kept with the action and in the audit log) and, when it moves money, how much.
 */
export function ActionModal({ config, onClose }: { config: ActionModalConfig | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote('');
    setError(null);
    setBusy(false);
    setAmount(config?.amount?.defaultAmount !== undefined ? String(config.amount.defaultAmount) : '');
    setDateTime(config?.dateTime?.defaultValue ?? '');
  }, [config]);

  if (!config) return null;

  const parsedAmount = config.amount ? Number(amount.replace(',', '.')) : null;
  const amountInvalid = config.amount
    ? !Number.isFinite(parsedAmount) || (parsedAmount ?? 0) < 0 || (parsedAmount ?? 0) > config.amount.max
    : false;
  const noteMissing = !config.noteOptional && !note.trim();
  const dateTimeInvalid = config.dateTime ? !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateTime.trim()) : false;

  async function confirm() {
    if (!config || busy || noteMissing || amountInvalid || dateTimeInvalid) return;
    setBusy(true);
    setError(null);
    try {
      await config.onConfirm(note.trim(), parsedAmount, config.dateTime ? dateTime.trim() : null);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo completar la acción.');
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={busy ? undefined : onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.body}>{config.description}</Text>
              {config.amount ? (
                <View style={styles.field}>
                  <Text style={styles.label}>{config.amount.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                  {amountInvalid ? (
                    <Text style={styles.error}>Tiene que ser entre $0 y ${config.amount.max.toLocaleString('es-AR')}.</Text>
                  ) : null}
                </View>
              ) : null}
              {config.dateTime ? (
                <View style={styles.field}>
                  <Text style={styles.label}>{config.dateTime.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={dateTime}
                    onChangeText={setDateTime}
                    placeholder="AAAA-MM-DD HH:MM"
                    placeholderTextColor={colors.textSecondary}
                  />
                  {dateTimeInvalid ? <Text style={styles.error}>Tiene que ser como 2026-10-12 20:30 (hora de Buenos Aires).</Text> : null}
                </View>
              ) : null}
              <View style={styles.field}>
                <Text style={styles.label}>{config.noteOptional ? 'Nota (opcional)' : 'Motivo'}</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder={config.notePlaceholder ?? 'Contá brevemente por qué'}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  onPress={onClose}
                  disabled={busy}
                  style={({ hovered }: PressableState) => [styles.cancelBtn, hovered && styles.cancelBtnHovered, CURSOR_POINTER]}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Button
                  title={config.confirmLabel}
                  variant={config.variant ?? 'primary'}
                  onPress={confirm}
                  loading={busy}
                  disabled={noteMissing || amountInvalid || dateTimeInvalid}
                />
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
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, gap: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text, backgroundColor: colors.background,
  },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelBtnHovered: { backgroundColor: colors.background },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
