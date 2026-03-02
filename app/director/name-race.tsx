import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../utils/colors';

export default function NameRaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [durationHours, setDurationHours] = useState('1');

  const canProceed = name.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Pressable
            style={styles.activeRacesButton}
            onPress={() => router.push('/director/races')}
          >
            <Text style={styles.activeRacesButtonText}>Active races</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Race Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Sunday Hill Climb"
          placeholderTextColor={Colors.textLight}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={50}
        />

        <Text style={[styles.label, { marginTop: 24 }]}>
          Submissions close after
        </Text>
        <View style={styles.expiryRow}>
          {[
            { value: '0.5', label: '30 min' },
            { value: '1', label: '1 h' },
            { value: '2', label: '2 h' },
            { value: '24', label: '24 h' },
          ].map(({ value, label }) => (
            <Pressable
              key={value}
              style={[
                styles.expiryChip,
                durationHours === value && styles.expiryChipActive,
              ]}
              onPress={() => setDurationHours(value)}
            >
              <Text
                style={[
                  styles.expiryChipText,
                  durationHours === value && styles.expiryChipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={() =>
            canProceed &&
            router.push({
              pathname: '/director/mark-course',
              params: { raceName: name.trim(), durationHours },
            })
          }
          disabled={!canProceed}
        >
          <Text style={styles.nextButtonText}>Next — Mark Course</Text>
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
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  activeRacesButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeRacesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
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
  expiryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  expiryChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expiryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  expiryChipText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  expiryChipTextActive: {
    color: Colors.textOnPrimary,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
