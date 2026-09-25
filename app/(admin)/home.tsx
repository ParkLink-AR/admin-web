import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/useSessionStore';

function Tile({ title, subtitle, icon, onPress }: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tileWrap}>
      <Card style={styles.tile}>
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={22} color={colors.teal} />
        </View>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const user = useSessionStore((s) => s.user);

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <PageHeader title="Inicio" subtitle={`Sesión iniciada como ${user?.email}`} />

        {/* flexWrap reflows these into columns on a wide window and a single
            column on a narrow one, without needing a hard breakpoint. */}
        <View style={styles.tiles}>
          <Tile
            title="Buscar usuarios"
            subtitle="Ver perfil, cocheras y reservas de un usuario"
            icon="people"
            onPress={() => router.push('/(admin)/users')}
          />
          <Tile
            title="Pagos pendientes"
            subtitle="Liquidar pagos a dueños de cocheras"
            icon="cash"
            onPress={() => router.push('/(admin)/payouts')}
          />
          <Tile
            title="Configuración"
            subtitle="Porcentaje de comisión de la plataforma"
            icon="settings"
            onPress={() => router.push('/(admin)/settings')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tileWrap: { flexGrow: 1, flexBasis: 260, minWidth: 220, maxWidth: 360 },
  tile: { gap: 6 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  tileSubtitle: { fontSize: 12, color: colors.textSecondary },
});
