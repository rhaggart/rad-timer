import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../utils/colors';
import { api, RaceSession } from '../../services/api';

export default function EnterNameScreen() {
  const router = useRouter();
  const { raceId, raceName: passedName } = useLocalSearchParams<{
    raceId: string;
    raceName?: string;
  }>();

  const [name, setName] = useState('');
  const [race, setRace] = useState<RaceSession | null>(null);
  const [loading, setLoading] = useState(!passedName);

  useEffect(() => {
    if (passedName) {
      setRace({ name: passedName } as RaceSession);
      return;
    }
    if (!raceId) return;
    api
      .getRace(raceId)
      .then(setRace)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [raceId, passedName]);

  const canProceed = name.trim().length > 0;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading race details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
        <View style={styles.raceInfo}>
          <Text style={styles.raceLabel}>RACE</Text>
          <Text style={styles.raceName}>{race?.name ?? 'Unknown Race'}</Text>
        </View>

        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor={Colors.textLight}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={30}
        />

        <Pressable
          style={[styles.button, !canProceed && styles.buttonDisabled]}
          onPress={() =>
            canProceed &&
            router.push({
              pathname: '/race/[id]/record',
              params: {
                id: raceId,
                participantName: name.trim(),
                raceName: race?.name,
              },
            })
          }
          disabled={!canProceed}
        >
          <Text style={styles.buttonText}>Ready to Race</Text>
        </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  raceInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  raceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    letterSpacing: 2,
  },
  raceName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.startGreen,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
