import { View, Text, StyleSheet, Pressable, Share, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '../../../utils/colors';

export default function InviteScreen() {
  const router = useRouter();
  const { id, raceName } = useLocalSearchParams<{
    id: string;
    raceName: string;
  }>();

  const joinUrl = `https://radtimer.com/join/${id}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my race "${raceName}" on RAD Timer!\n${joinUrl}`,
        url: joinUrl,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.raceName}>{raceName}</Text>
      <Text style={styles.hint}>
        Have racers scan this QR code to join
      </Text>

      <View style={styles.qrContainer}>
        <QRCode value={joinUrl} size={240} backgroundColor="white" />
      </View>

      <Text style={styles.url}>{joinUrl}</Text>

      <View style={styles.buttons}>
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share Link</Text>
        </Pressable>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: '/race/[id]/leaderboard',
              params: { id },
            })
          }
        >
          <Text style={styles.primaryButtonText}>See Results</Text>
        </Pressable>

        <Pressable
          style={styles.racingButton}
          onPress={() =>
            router.push({
              pathname: '/racer/enter-name',
              params: { raceId: id, raceName },
            })
          }
        >
          <Text style={styles.racingButtonText}>I'm Racing Too</Text>
        </Pressable>

        <Pressable
          style={styles.mapLinkButton}
          onPress={() =>
            router.push({
              pathname: '/race/[id]/map',
              params: { id, raceName },
            })
          }
        >
          <Text style={styles.mapLinkButtonText}>Show race on map</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  raceName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  hint: {
    fontSize: 15,
    color: Colors.textLight,
    marginTop: 8,
    marginBottom: 32,
  },
  qrContainer: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  url: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  buttons: {
    width: '100%',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 32,
  },
  shareButton: {
    backgroundColor: Colors.surface,
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
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  racingButton: {
    backgroundColor: Colors.startGreen,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  racingButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  mapLinkButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  mapLinkButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
