import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../utils/colors';

export default function RacerHomeScreen() {
  const router = useRouter();
  const { id, raceName } = useLocalSearchParams<{ id: string; raceName: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.raceName}>{raceName ?? 'Race'}</Text>
        <Text style={styles.hint}>You joined this race. Start tracking or view results.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: '/racer/enter-name',
              params: { raceId: id, raceName },
            })
          }
        >
          <Text style={styles.buttonText}>Start Tracking</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            router.push({
              pathname: '/race/[id]/leaderboard',
              params: { id: id! },
            })
          }
        >
          <Text style={styles.secondaryButtonText}>See Results</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 16,
  },
  backButtonText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 8,
  },
  raceName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 15,
    color: Colors.textLight,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
});
