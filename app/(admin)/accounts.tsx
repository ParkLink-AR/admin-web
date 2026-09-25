import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { Button } from '@/src/components/Button';
import { AdminRoleBadge, AdminActiveBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { listAdminAccounts, createAdminAccount, setAdminAccountActive } from '@/src/api/admin';
import { AdminAccount, AdminAccountRole } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';
import { useSessionStore } from '@/src/store/useSessionStore';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "Administradores" -- CRUD over the admin identity system itself
// (/admin/accounts). SUPERADMIN-only: app/(admin)/_layout.tsx already hides
// the nav entry for a plain ADMIN, but this screen also gates itself in case
// one navigates here directly (deep link, browser back/forward, etc.).
export default function AdminAccounts() {
  const sessionUser = useSessionStore((s) => s.user);
  const isSuperadmin = sessionUser?.role === 'SUPERADMIN';
  const isDesktop = useIsDesktop();

  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createVisible, setCreateVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminAccountRole>('ADMIN');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [toggleTarget, setToggleTarget] = useState<AdminAccount | null>(null);
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listAdminAccounts());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los administradores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin, load]);

  if (!isSuperadmin) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.unauthorizedTitle}>No autorizado</Text>
        <Text style={styles.hint}>Esta sección es exclusiva para administradores con rol SUPERADMIN.</Text>
      </Screen>
    );
  }

  function openCreate() {
    setNewUsername('');
    setNewPassword('');
    setNewRole('ADMIN');
    setCreateError(null);
    setCreateVisible(true);
  }

  async function handleCreate() {
    const username = newUsername.trim();
    if (!username || !newPassword) {
      setCreateError('Ingresá un usuario y una contraseña.');
      return;
    }
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const created = await createAdminAccount({ username, password: newPassword, role: newRole });
      setAccounts((prev) => [created, ...prev]);
      setCreateVisible(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.detail : 'No se pudo crear el administrador.');
    } finally {
      setCreateSubmitting(false);
    }
  }

  function askToggle(account: AdminAccount) {
    setToggleError(null);
    setToggleTarget(account);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    setToggleSubmitting(true);
    setToggleError(null);
    try {
      const updated = await setAdminAccountActive(toggleTarget.id, !toggleTarget.isActive);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setToggleTarget(null);
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.detail : 'No se pudo actualizar el administrador.');
    } finally {
      setToggleSubmitting(false);
    }
  }

  function ToggleButton({ account }: { account: AdminAccount }) {
    const isSelf = account.id === sessionUser?.id;
    if (isSelf) {
      return <Text style={styles.selfNote}>Tu cuenta</Text>;
    }
    return (
      <Pressable
        onPress={() => askToggle(account)}
        style={({ hovered }: PressableState) => [
          styles.toggleBtn,
          account.isActive ? styles.toggleBtnDeactivate : styles.toggleBtnActivate,
          hovered && (account.isActive ? styles.toggleBtnDeactivateHovered : styles.toggleBtnActivateHovered),
          CURSOR_POINTER,
        ]}
      >
        <Text style={[styles.toggleBtnText, account.isActive ? styles.toggleBtnTextDeactivate : styles.toggleBtnTextActivate]}>
          {account.isActive ? 'Desactivar' : 'Activar'}
        </Text>
      </Pressable>
    );
  }

  const headerActions = (
    <Button title="Nuevo administrador" onPress={openCreate} style={styles.newBtn} />
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <PageHeader title="Administradores" subtitle="Cuentas de staff con acceso a esta herramienta." />
          {headerActions}
        </View>

        {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && accounts.length === 0 ? (
          <Text style={styles.hint}>Todavía no hay administradores cargados.</Text>
        ) : null}

        {isDesktop && accounts.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colUsername]}>Usuario</Text>
              <Text style={[styles.th, styles.colRole]}>Rol</Text>
              <Text style={[styles.th, styles.colStatus]}>Estado</Text>
              <Text style={[styles.th, styles.colDate]}>Creado</Text>
              <Text style={[styles.th, styles.colDate]}>Último ingreso</Text>
              <Text style={[styles.th, styles.colAction]}>Acción</Text>
            </View>
            <FlatList
              data={accounts}
              keyExtractor={(a) => a.id}
              renderItem={({ item }) => (
                <View style={styles.tableRow}>
                  <Text style={[styles.td, styles.colUsername]} numberOfLines={1}>{item.username}</Text>
                  <View style={styles.colRole}>
                    <AdminRoleBadge role={item.role} />
                  </View>
                  <View style={styles.colStatus}>
                    <AdminActiveBadge isActive={item.isActive} />
                  </View>
                  <Text style={[styles.tdSecondary, styles.colDate]}>{formatDate(item.createdAt)}</Text>
                  <Text style={[styles.tdSecondary, styles.colDate]}>
                    {item.lastLoginAt ? formatDateTime(item.lastLoginAt) : 'Nunca'}
                  </Text>
                  <View style={styles.colAction}>
                    <ToggleButton account={item} />
                  </View>
                </View>
              )}
            />
          </View>
        ) : (
          <FlatList
            data={accounts}
            keyExtractor={(a) => a.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardUsername}>{item.username}</Text>
                  <View style={styles.badges}>
                    <AdminRoleBadge role={item.role} />
                    <AdminActiveBadge isActive={item.isActive} />
                  </View>
                </View>
                <Text style={styles.caption}>Creado: {formatDate(item.createdAt)}</Text>
                <Text style={styles.caption}>
                  Último ingreso: {item.lastLoginAt ? formatDateTime(item.lastLoginAt) : 'Nunca'}
                </Text>
                <View style={styles.cardAction}>
                  <ToggleButton account={item} />
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Create form -- a small centered dialog, not a full-screen takeover,
          consistent with the confirm/success dialogs used elsewhere in this
          app (PayoutDetailPanel, settings.tsx). */}
      <Modal visible={createVisible} transparent animationType="fade" onRequestClose={() => setCreateVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setCreateVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Nuevo administrador</Text>

                <Text style={styles.fieldLabel}>Usuario</Text>
                <TextInput
                  style={styles.input}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="usuario"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Contraseña"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>Rol</Text>
                <View style={styles.roleRow}>
                  {(['ADMIN', 'SUPERADMIN'] as AdminAccountRole[]).map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => setNewRole(role)}
                      style={({ hovered }: PressableState) => [
                        styles.roleChip,
                        newRole === role && styles.roleChipActive,
                        hovered && newRole !== role && styles.roleChipHovered,
                        CURSOR_POINTER,
                      ]}
                    >
                      <Text style={[styles.roleChipText, newRole === role && styles.roleChipTextActive]}>{role}</Text>
                    </Pressable>
                  ))}
                </View>

                {createError ? <Text style={styles.error}>{createError}</Text> : null}

                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [
                      styles.modalCancelBtn,
                      hovered && styles.modalCancelBtnHovered,
                      CURSOR_POINTER,
                    ]}
                    onPress={() => setCreateVisible(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Button title="Crear" onPress={handleCreate} loading={createSubmitting} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Activate/deactivate confirm -- same pattern as PayoutDetailPanel's
          mark-paid confirm modal. */}
      <Modal visible={!!toggleTarget} transparent animationType="fade" onRequestClose={() => setToggleTarget(null)}>
        <TouchableWithoutFeedback onPress={() => setToggleTarget(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>
                  {toggleTarget?.isActive ? 'Desactivar administrador' : 'Activar administrador'}
                </Text>
                <Text style={styles.modalBody}>
                  {toggleTarget?.isActive
                    ? `${toggleTarget?.username} no va a poder iniciar sesión hasta que se reactive la cuenta.`
                    : `${toggleTarget?.username} va a poder volver a iniciar sesión.`}
                </Text>
                {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ hovered }: PressableState) => [
                      styles.modalCancelBtn,
                      hovered && styles.modalCancelBtnHovered,
                      CURSOR_POINTER,
                    ]}
                    onPress={() => setToggleTarget(null)}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Button
                    title="Confirmar"
                    variant={toggleTarget?.isActive ? 'danger' : 'primary'}
                    onPress={confirmToggle}
                    loading={toggleSubmitting}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  unauthorizedTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { flex: 1, padding: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  newBtn: { paddingHorizontal: 16, paddingVertical: 11 },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 8 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },

  // Narrow (stacked card) layout.
  list: { paddingVertical: 12, gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardUsername: { fontSize: 15, fontWeight: '600', color: colors.text },
  badges: { flexDirection: 'row', gap: 6 },
  caption: { fontSize: 12, color: colors.textSecondary },
  cardAction: { marginTop: 8, alignItems: 'flex-start' },

  // Desktop table layout.
  table: { flex: 1, marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  td: { fontSize: 14, color: colors.text, fontWeight: '600' },
  tdSecondary: { fontSize: 13, color: colors.textSecondary },
  colUsername: { flex: 2 },
  colRole: { flex: 1 },
  colStatus: { flex: 1 },
  colDate: { flex: 2 },
  colAction: { flex: 1, alignItems: 'flex-start' },

  selfNote: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  toggleBtnActivate: { backgroundColor: colors.white, borderColor: colors.success },
  toggleBtnActivateHovered: { backgroundColor: '#EAF7EE' },
  toggleBtnDeactivate: { backgroundColor: colors.white, borderColor: colors.danger },
  toggleBtnDeactivateHovered: { backgroundColor: '#FDEDED' },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },
  toggleBtnTextActivate: { color: colors.success },
  toggleBtnTextDeactivate: { color: colors.danger },

  // Small centered dialogs (not full-screen takeovers) for the create form
  // and the activate/deactivate confirm -- matches PayoutDetailPanel and
  // settings.tsx's modal pattern.
  modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, gap: 6 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalCancelBtnHovered: { backgroundColor: colors.background },
  modalCancelBtnText: { color: colors.textSecondary, fontWeight: '600' },

  fieldLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text,
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  roleChipActive: { backgroundColor: colors.deepNavy, borderColor: colors.deepNavy },
  roleChipHovered: { backgroundColor: colors.background },
  roleChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  roleChipTextActive: { color: colors.white },
});
