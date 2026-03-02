import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.title}>RAD</Text>
          <Text style={styles.subtitle}>TIMER</Text>
          <Text style={styles.tagline}>GPS Race Timing</Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, styles.directorButton]}
            onPress={() => router.push('/director/name-race')}
          >
            <Text style={styles.buttonIcon}>🏁</Text>
            <Text style={styles.buttonText}>Race Director</Text>
            <Text style={styles.buttonHint}>Create and manage a race</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.racerButton]}
            onPress={() => router.push('/racer/scan')}
          >
            <Text style={styles.buttonIcon}>🚴</Text>
            <Text style={styles.buttonText}>Racer</Text>
            <Text style={styles.buttonHint}>Scan a QR code to join</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.secondary,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 64,
  },
  title: {
    fontSize: 72,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 36,
    fontWeight: '300',
    color: Colors.textOnSecondary,
    letterSpacing: 16,
    marginTop: -8,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  buttons: {
    gap: 16,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  directorButton: {
    backgroundColor: Colors.primary,
  },
  racerButton: {
    backgroundColor: Colors.secondaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  buttonHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});
