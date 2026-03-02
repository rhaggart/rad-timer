import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../../utils/colors';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    const raceIdMatch =
      data.match(/radtimer\.com\/join\/([a-zA-Z0-9-]+)/) ??
      data.match(/radtimer:\/\/join\?raceId=([a-zA-Z0-9-]+)/);

    if (!raceIdMatch) return;

    setScanned(true);
    const raceId = raceIdMatch[1];

    router.push({
      pathname: '/racer/enter-name',
      params: { raceId },
    });
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Pressable
          style={styles.homeButtonPermission}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.permissionText}>
          Camera access is needed to scan race QR codes
        </Text>
        <Pressable style={styles.grantButton} onPress={requestPermission}>
          <Text style={styles.grantButtonText}>Grant Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.homeButton}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.homeButtonText}>Back</Text>
      </Pressable>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>
            Point at a RAD Timer QR code
          </Text>
        </View>
      </CameraView>

      {scanned && (
        <Pressable
          style={styles.rescanButton}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.rescanText}>Tap to scan again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: Colors.primary,
    borderRadius: 20,
  },
  scanHint: {
    color: 'white',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
  },
  homeButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  homeButtonPermission: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 32,
    gap: 24,
  },
  permissionText: {
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
  },
  grantButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  grantButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  rescanButton: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  rescanText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
