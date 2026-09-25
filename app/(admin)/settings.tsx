import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Modal, Pressable, TouchableWithoutFeedback, ViewStyle } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { getCommissionSettings, updateCommissionSettings } from '@/src/api/admin';
import { ApiError } from '@/src/api/client';

type PressableState = { pressed: boolean; hovered?: boolean };

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPercent, setCurrentPercent] = useState<number | null>(null);
  const [inputPercent, setInputPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCommissionSettings()
      .then((s) => {
        if (cancelled) return;
        setCurrentPercent(s.commissionRatePercent);
        setInputPercent(String(s.commissionRatePercent));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : 'No se pudo cargar la configuración.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function parsedPercent(): number | null {
    const normalized = inputPercent.replace(',', '.').trim();
    if (!normalized) return null;
    const value = Number(normalized);
    if (Number.isNaN(value)) return null;
    return value;
  }

  const percent = parsedPercent();
  const isValid = percent !== null && percent >= 0 && percent <= 100;

  async function handleSave() {
    if (!isValid || percent === null) {
      setSaveError('Ingresá un porcentaje válido entre 0 y 100.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // basis points: 1% = 100 bp, so round to the nearest whole bp.
      const bp = Math.round(percent * 100);
      const updated = await updateCommissionSettings(bp);
      setCurrentPercent(updated.commissionRatePercent);
      setInputPercent(String(updated.commissionRatePercent));
      setSuccessVisible(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Configuración" />
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Comisión de la plataforma</Text>
          <Text style={styles.hint}>
            Porcentaje actual: <Text style={styles.currentValue}>{currentPercent}%</Text>
          </Text>
          <Text style={styles.label}>Nuevo porcentaje (0 a 100)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={inputPercent}
            onChangeText={(v) => {
              setInputPercent(v);
              setSaveError(null);
            }}
            placeholder="5.0"
            placeholderTextColor={colors.textSecondary}
          />
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <Button title="Guardar" onPress={handleSave} disabled={!isValid} loading={saving} style={styles.saveBtn} />
        </Card>
      </View>

      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setSuccessVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Comisión actualizada</Text>
                <Text style={styles.modalBody}>El nuevo porcentaje de comisión se guardó correctamente.</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [
                      styles.modalConfirmBtn,
                      hovered && styles.modalConfirmBtnHovered,
                      { cursor: 'pointer' } as unknown as ViewStyle,
                    ]}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 8 },
  body: { padding: 24, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  card: { maxWidth: 480 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  currentValue: { fontWeight: '700', color: colors.text },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  saveBtn: { marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  modalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.teal },
  modalConfirmBtnHovered: { backgroundColor: '#137274' },
  modalConfirmBtnText: { color: colors.white, fontWeight: '700' },
});
