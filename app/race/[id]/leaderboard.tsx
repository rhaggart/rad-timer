import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Share,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../utils/colors';
import { api, LeaderboardEntry, RaceSession } from '../../../services/api';
import { formatElapsedTime, formatDebugTimestamp } from '../../../utils/formatTime';

interface RankedEntry extends LeaderboardEntry {
  rank: number;
  hasMultipleAttempts: boolean;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { id, participantName: currentParticipantName } = useLocalSearchParams<{ id: string; participantName?: string }>();

  const [race, setRace] = useState<RaceSession | null>(null);
  const [entries, setEntries] = useState<RankedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getLeaderboard(id);
      setRace(data.race);

      const nameCounts: Record<string, number> = {};
      data.results.forEach((r) => {
        nameCounts[r.participantName] =
          (nameCounts[r.participantName] ?? 0) + 1;
      });

      const ranked: RankedEntry[] = data.results.map((r, i) => ({
        ...r,
        rank: i + 1,
        hasMultipleAttempts: nameCounts[r.participantName] > 1,
      }));

      setEntries(ranked);
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleShare = async () => {
    const url = `https://radtimer.com/join/${id}`;
    try {
      await Share.share({
        message: `Check out the results for "${race?.name}" on RAD Timer!\n${url}`,
        url,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.raceName}>{race?.name ?? 'Race'}</Text>
        <View
          style={[
            styles.statusBadge,
            race?.status === 'closed' && styles.statusClosed,
          ]}
        >
          <Text style={styles.statusText}>
            {race?.status === 'open' ? 'OPEN' : 'CLOSED'}
          </Text>
        </View>
      </View>
      <Text style={styles.resultsKeptNote}>
        {race?.plan === 'paid'
          ? 'Results are kept indefinitely.'
          : 'Results are kept for 24 hours.'}
      </Text>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.resultId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No results yet</Text>
            <Text style={styles.emptyHint}>
              Pull to refresh after racers submit their tracks
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rankContainer}>
              <Text
                style={[
                  styles.rank,
                  item.rank === 1 && styles.rankGold,
                  item.rank === 2 && styles.rankSilver,
                  item.rank === 3 && styles.rankBronze,
                ]}
              >
                {item.rank}
              </Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.participantName}</Text>
                {item.hasMultipleAttempts && (
                  <View style={styles.attemptBadge}>
                    <Text style={styles.attemptBadgeText}>
                      Run {item.attemptNumber}
                    </Text>
                  </View>
                )}
                {item.gpsSampling === 'high' && (
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>High GPS</Text>
                  </View>
                )}
                {item.timestampFallback && (
                  <View style={styles.fallbackBadge}>
                    <Text style={styles.fallbackBadgeText}>⚠ device time</Text>
                  </View>
                )}
              </View>
              {race?.stages?.length && item.stageTimes && item.stageTimes.length > 0 && (
                <View style={styles.stageTimesRow}>
                  {item.stageTimes.map((t, i) => (
                    <Text key={i} style={styles.stageTimeChip}>
                      S{i + 1}: {formatElapsedTime(t)}
                    </Text>
                  ))}
                </View>
              )}
              {item.startTime != null && item.finishTime != null && (
                <Text style={styles.debugLine}>
                  Start {formatDebugTimestamp(item.startTime)} → End {formatDebugTimestamp(item.finishTime)}
                </Text>
              )}
            </View>
            <View style={styles.timeBlock}>
              <Text style={[styles.time, item.timestampFallback && styles.timeFlagged]}>
                {formatElapsedTime(item.elapsedTime)}
              </Text>
              {item.timestampFallback && (
                <Text style={styles.flaggedHint}>may vary</Text>
              )}
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        {race?.plan === 'paid' && (
          <Pressable
            style={styles.pdfButton}
            onPress={() => {
              const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? 'https://api.radtimer.com';
              Linking.openURL(`${apiUrl}/races/${id}/leaderboard.pdf`);
            }}
          >
            <Text style={styles.pdfButtonText}>Download PDF</Text>
          </Pressable>
        )}
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share Race</Text>
        </Pressable>
        <Pressable
          style={styles.raceAgainButton}
          onPress={() =>
            router.push({
              pathname: '/racer/enter-name',
              params: { raceId: id, raceName: race?.name, participantName: currentParticipantName ?? '' },
            })
          }
        >
          <Text style={styles.raceAgainText}>Race Again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  raceName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  statusBadge: {
    backgroundColor: Colors.startGreen,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusClosed: {
    backgroundColor: Colors.textLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 1,
  },
  resultsKeptNote: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textLight,
  },
  rankGold: {
    color: '#F59E0B',
  },
  rankSilver: {
    color: '#9CA3AF',
  },
  rankBronze: {
    color: '#D97706',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  attemptBadge: {
    backgroundColor: Colors.flagBadge,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  attemptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  time: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textLight,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  stageTimesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  stageTimeChip: {
    fontSize: 12,
    color: Colors.textLight,
    fontVariant: ['tabular-nums'],
  },
  gpsBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  gpsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  fallbackBadge: {
    backgroundColor: Colors.warning,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  fallbackBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  debugLine: {
    fontSize: 10,
    color: Colors.textLight,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  timeBlock: {
    alignItems: 'flex-end',
  },
  timeFlagged: {
    color: Colors.warning,
  },
  flaggedHint: {
    fontSize: 9,
    color: Colors.textLight,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pdfButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pdfButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  shareButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  raceAgainButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  raceAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
