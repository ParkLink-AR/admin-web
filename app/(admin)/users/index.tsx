import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { AccountTypeBadge, UserStatusBadge } from '@/src/components/Badge';
import { colors } from '@/src/theme/colors';
import { searchUsers } from '@/src/api/admin';
import { AdminUserSummary } from '@/src/types';
import { ApiError } from '@/src/api/client';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

function displayName(u: AdminUserSummary) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

export default function UsersSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const isDesktop = useIsDesktop();

  // Debounced -- only fires once the admin stops typing for a moment, and
  // never with an empty query (the endpoint requires a non-empty `query`).
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const users = await searchUsers(trimmed);
        setResults(users);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'No se pudo buscar usuarios.');
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  const showEmptyHint = !loading && !error && !query.trim();
  const showNoResults = !loading && !error && !!query.trim() && searched && results.length === 0;

  function openUser(id: string) {
    router.push(`/(admin)/users/${id}`);
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Buscar usuarios" subtitle="Buscá por nombre, email o DNI." />
        <TextInput
          style={styles.input}
          placeholder="Buscar por nombre, email o DNI..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
        />
        {loading ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {showEmptyHint ? (
          <Text style={styles.hint}>Escribí un nombre, email o DNI para buscar usuarios.</Text>
        ) : null}
        {showNoResults ? <Text style={styles.hint}>No se encontraron usuarios.</Text> : null}

        {isDesktop && results.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colName]}>Nombre</Text>
              <Text style={[styles.th, styles.colEmail]}>Email</Text>
              <Text style={[styles.th, styles.colDni]}>DNI</Text>
              <Text style={[styles.th, styles.colType]}>Tipo</Text>
              <Text style={[styles.th, styles.colStatus]}>Estado</Text>
            </View>
            <FlatList
              data={results}
              keyExtractor={(u) => u.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => openUser(item.id)}
                  style={({ hovered }: PressableState) => [styles.tableRow, hovered && styles.tableRowHovered, CURSOR_POINTER]}
                >
                  <Text style={[styles.td, styles.colName]} numberOfLines={1}>{displayName(item)}</Text>
                  <Text style={[styles.tdSecondary, styles.colEmail]} numberOfLines={1}>{item.email}</Text>
                  <Text style={[styles.tdSecondary, styles.colDni]} numberOfLines={1}>{item.dni ?? '-'}</Text>
                  <View style={styles.colType}>
                    <AccountTypeBadge accountType={item.accountType} />
                  </View>
                  <View style={styles.colStatus}>
                    <UserStatusBadge status={item.status} />
                  </View>
                </Pressable>
              )}
            />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(u) => u.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable onPress={() => openUser(item.id)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{displayName(item)}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  {item.dni ? <Text style={styles.email}>DNI: {item.dni}</Text> : null}
                </View>
                <View style={styles.badges}>
                  <AccountTypeBadge accountType={item.accountType} />
                  <UserStatusBadge status={item.status} />
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 24, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  spinner: { marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 24 },

  // Narrow (stacked card) layout.
  list: { paddingVertical: 12, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  badges: { gap: 6, alignItems: 'flex-end' },

  // Desktop table layout.
  table: { flex: 1, marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableHeaderRow: {
    flexDirection: 'row',
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
  tableRowHovered: { backgroundColor: colors.background },
  td: { fontSize: 14, color: colors.text, fontWeight: '600' },
  tdSecondary: { fontSize: 13, color: colors.textSecondary },
  colName: { flex: 2 },
  colEmail: { flex: 3 },
  colDni: { flex: 1 },
  colType: { flex: 2 },
  colStatus: { flex: 1 },
});
