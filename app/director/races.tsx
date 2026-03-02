import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import type { RaceSession } from '../../services/api';
import { api } from '../../services/api';
import { Colors } from '../../utils/colors';

function formatExpiry(expiresAt: string): string {
  const d = new Date(expiresAt);
  const now = new Date();
  if (d <= now) return 'Expired';
  const mins = Math.round((d.getTime() - now.getTime()) / 60000);
  if (mins < 60) return `Expires in ${mins} min`;
  const hours = Math.round(mins / 60);
  return `Expires in ${hours}h`;
}

function RaceRow({
  race,
  onPress,
  onDelete,
}: {
  race: RaceSession;
  onPress: () => void;
  onDelete: () => void;
}) {
  const renderRightActions = () => (
    <Pressable style={styles.deleteAction} onPress={onDelete}>
      <Text style={styles.deleteActionText}>Delete</Text>
    </Pressable>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <Pressable style={styles.row} onPress={onPress}>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {race.name}
          </Text>
          <Text style={styles.rowSubtitle}>{formatExpiry(race.expiresAt)}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Swipeable>
  );
}

export default function RunningRacesScreen() {
  const router = useRouter();
  const [races, setRaces] = useState<RaceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { races: list } = await api.listRaces();
      setRaces(list);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to load races',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = useCallback(
    (race: RaceSession) => {
      Alert.alert(
        'Delete race',
        `Remove "${race.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteRace(race.raceId);
                setRaces((prev) => prev.filter((r) => r.raceId !== race.raceId));
              } catch (err) {
                Alert.alert(
                  'Error',
                  err instanceof Error ? err.message : 'Failed to delete race',
                );
              }
            },
          },
        ],
      );
    },
    [],
  );

  if (loading && races.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centeredText}>Loading races…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={races}
      keyExtractor={(item) => item.raceId}
      contentContainerStyle={[
        styles.list,
        races.length === 0 && styles.listEmpty,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={Colors.primary}
        />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          No active races. Create one from the Create Race screen.
        </Text>
      }
      renderItem={({ item }) => (
        <RaceRow
          race={item}
          onPress={() =>
            router.push({
              pathname: '/race/[id]/invite',
              params: { id: item.raceId, raceName: item.name },
            })
          }
          onDelete={() => handleDelete(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  centeredText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  list: {
    paddingVertical: 8,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    minHeight: 56,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  rowSubtitle: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textLight,
    marginLeft: 8,
  },
  deleteAction: {
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 4,
    marginRight: 16,
    borderRadius: 10,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
