import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { PageHeader } from '@/src/components/PageHeader';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { ADMIN_SECTION_GROUPS, AdminSection, sectionsFor } from '@/src/navigation';
import {
  countFailedRefunds,
  countPendingReports,
  getOwnerPendingBalances,
  listPendingParkingSpots,
  listSettlements,
  listUnverifiedBookings,
} from '@/src/api/admin';
import { formatCentavos } from '@/src/services/money';
import { MetricsPanel } from '@/src/components/MetricsPanel';

type PressableState = { pressed: boolean; hovered?: boolean };

// One loaded figure for the "Para atender ahora" row: undefined while loading, null if
// its request failed (each one loads on its own, so one failing doesn't blank the rest).
type Figure<T> = T | null | undefined;

function useFigure<T>(load: () => Promise<T>): Figure<T> {
  const [value, setValue] = useState<Figure<T>>(undefined);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((v) => !cancelled && setValue(v))
      .catch(() => !cancelled && setValue(null));
    return () => {
      cancelled = true;
    };
    // `load` is a module-level API call per figure -- it never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

function hoverable(hovered: boolean | undefined) {
  return [{ cursor: 'pointer' } as unknown as ViewStyle, hovered && styles.hovered];
}

function PendingTile({ count, label, detail, icon, href }: {
  count: Figure<number>;
  label: string;
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}) {
  const pending = typeof count === 'number' && count > 0;
  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ hovered }: PressableState) => [styles.pendingWrap, ...hoverable(hovered)]}
    >
      <Card style={pending ? { ...styles.pendingCard, ...styles.pendingCardActive } : styles.pendingCard}>
        <View style={styles.pendingTop}>
          <Ionicons name={icon} size={18} color={pending ? colors.warning : colors.textSecondary} />
          {count === undefined ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : (
            <Text style={[styles.pendingCount, pending && styles.pendingCountActive]}>
              {count === null ? '—' : count}
            </Text>
          )}
        </View>
        <Text style={styles.pendingLabel}>{label}</Text>
        <Text style={[styles.pendingDetail, count === 0 && styles.pendingDetailDone]}>
          {count === null ? 'No se pudo cargar' : count === 0 ? 'Todo al día' : detail ?? ' '}
        </Text>
      </Card>
    </Pressable>
  );
}

function SectionRow({ section }: { section: AdminSection }) {
  return (
    <Pressable
      onPress={() => router.push(section.href as never)}
      style={({ hovered }: PressableState) => [styles.sectionRow, ...hoverable(hovered)]}
    >
      <View style={styles.sectionIcon}>
        <Ionicons name={section.icon} size={18} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionLabel}>{section.label}</Text>
        <Text style={styles.sectionDescription}>{section.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function Home() {
  const user = useSessionStore((s) => s.user);
  const sections = sectionsFor(user?.role).filter((section) => section.group);

  const spotsToReview = useFigure(() => listPendingParkingSpots().then((r) => r.length));
  const unverified = useFigure(() => listUnverifiedBookings().then((r) => r.length));
  const balances = useFigure(getOwnerPendingBalances);
  const draftSettlements = useFigure(() => listSettlements('PENDING').then((r) => r.length));
  const failedRefunds = useFigure(countFailedRefunds);
  const pendingReports = useFigure(countPendingReports);

  const balancesTotal = balances ? balances.reduce((sum, b) => sum + b.pendingNetAmount, 0) : 0;

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageHeader title={`Hola, ${user?.username ?? ''}`} subtitle="Panel de administración de ParkLink" />

        <Card style={styles.intro}>
          <Text style={styles.introText}>
            Desde acá el equipo de ParkLink mantiene la plataforma funcionando: revisa las cocheras nuevas antes de
            que aparezcan en las búsquedas, resuelve las reservas que terminaron sin que el dueño verificara la
            llegada del conductor y les paga a los dueños lo que ganaron con sus cocheras.
          </Text>
        </Card>

        <Text style={styles.heading}>Para atender ahora</Text>
        <View style={styles.pendingRow}>
          <PendingTile
            count={spotsToReview}
            label="Cocheras por revisar"
            detail="Esperando aprobación para publicarse"
            icon="checkmark-done-circle"
            href="/(admin)/spot-review"
          />
          <PendingTile
            count={unverified}
            label="Reservas sin verificar"
            detail="Con el pago al dueño retenido"
            icon="alert-circle"
            href="/(admin)/unverified"
          />
          <PendingTile
            count={balances === undefined || balances === null ? balances : balances.length}
            label="Dueños con saldo a pagar"
            detail={balances ? `${formatCentavos(balancesTotal)} en total` : undefined}
            icon="cash"
            href="/(admin)/payouts"
          />
          <PendingTile
            count={failedRefunds}
            label="Reembolsos pendientes"
            detail="Mercado Pago no los pudo hacer"
            icon="arrow-undo-circle"
            href="/(admin)/refunds"
          />
          <PendingTile
            count={draftSettlements}
            label="Liquidaciones sin confirmar"
            detail="Preparadas, falta la transferencia"
            icon="receipt"
            href="/(admin)/settlements"
          />
          <PendingTile
            count={pendingReports}
            label="Denuncias sin resolver"
            detail="Cocheras, usuarios o reseñas"
            icon="flag"
            href="/(admin)/reports"
          />
        </View>

        <Text style={styles.heading}>Métricas</Text>
        <MetricsPanel />

        <Text style={styles.heading}>Secciones</Text>
        <View style={styles.groups}>
          {ADMIN_SECTION_GROUPS.map((group) => {
            const items = sections.filter((section) => section.group === group);
            if (items.length === 0) return null;
            return (
              <Card key={group} style={styles.group}>
                <Text style={styles.groupTitle}>{group}</Text>
                {items.map((section) => (
                  <SectionRow key={section.href} section={section} />
                ))}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  hovered: { transform: [{ translateY: -1 }], opacity: 0.92 },

  intro: { borderLeftWidth: 4, borderLeftColor: colors.teal },
  introText: { fontSize: 14, lineHeight: 22, color: colors.text },

  heading: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },

  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pendingWrap: { flexGrow: 1, flexBasis: 220, minWidth: 200, borderRadius: 14 },
  pendingCard: { gap: 4, height: '100%' },
  pendingCardActive: { borderWidth: 1, borderColor: colors.warning },
  pendingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 },
  pendingCount: { fontSize: 28, fontWeight: '700', color: colors.textSecondary },
  pendingCountActive: { color: colors.text },
  pendingLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  pendingDetail: { fontSize: 12, color: colors.textSecondary },
  pendingDetailDone: { color: colors.success, fontWeight: '600' },


  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  group: { flexGrow: 1, flexBasis: 320, minWidth: 260, gap: 2 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderRadius: 8 },
  sectionIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#E6F4F4', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  sectionDescription: { fontSize: 12, color: colors.textSecondary },
});
