import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../utils/colors';

export default function NameRaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [expiryHours, setExpiryHours] = useState('4');

  const canProceed = name.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
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
          Race Duration (hours)
        </Text>
        <View style={styles.expiryRow}>
          {['2', '4', '8', '24'].map((h) => (
            <Pressable
              key={h}
              style={[
                styles.expiryChip,
                expiryHours === h && styles.expiryChipActive,
              ]}
              onPress={() => setExpiryHours(h)}
            >
              <Text
                style={[
                  styles.expiryChipText,
                  expiryHours === h && styles.expiryChipTextActive,
                ]}
              >
                {h}h
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
              params: { raceName: name.trim(), expiryHours },
            })
          }
          disabled={!canProceed}
        >
          <Text style={styles.nextButtonText}>Next — Mark Course</Text>
        </Pressable>
      </View>
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
