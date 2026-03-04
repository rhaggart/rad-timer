import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '../utils/colors';
import type { ActiveRecord } from '../utils/activeRecordStore';
import { getActiveRecord, subscribeActiveRecord } from '../utils/activeRecordStore';

export function ActiveRecordBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState<ActiveRecord | null>(getActiveRecord());

  useEffect(() => {
    setActive(getActiveRecord());
    const unsub = subscribeActiveRecord(() => setActive(getActiveRecord()));
    return unsub;
  }, []);

  if (!active) return null;
  // Don't show banner when already on the record screen for this race
  if (pathname?.includes('/record')) return null;

  const goToRecord = () => {
    router.push({
      pathname: '/race/[id]/record',
      params: {
        id: active.raceId,
        participantName: active.participantName,
        raceName: active.raceName,
        ...(active.isDirector && { isDirector: '1' }),
      },
    });
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText} numberOfLines={2}>
        You have a track in progress — finish and upload to save your time.
      </Text>
      <Pressable style={styles.bannerButton} onPress={goToRecord}>
        <Text style={styles.bannerButtonText}>Go to track</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  bannerButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  bannerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
