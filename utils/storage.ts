/**
 * Key-value storage that works in Expo Go (where AsyncStorage native module can be null).
 * Uses AsyncStorage when available, otherwise falls back to in-memory (session-only).
 */
const memory: Record<string, string> = {};
let useMemory = false;
let availabilityChecked = false;

function getAsyncStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

async function isAsyncStorageAvailable(): Promise<boolean> {
  if (availabilityChecked) return !useMemory;
  availabilityChecked = true;
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) {
    useMemory = true;
    return false;
  }
  try {
    await AsyncStorage.setItem('@radtimer/_ping', '1');
    await AsyncStorage.removeItem('@radtimer/_ping');
    return true;
  } catch {
    // Expo Go: "native module is null, cannot access legacy storage"
    useMemory = true;
    return false;
  }
}

export async function storageGetItem(key: string): Promise<string | null> {
  if (useMemory) return memory[key] ?? null;
  try {
    const available = await isAsyncStorageAvailable();
    if (available) {
      const AsyncStorage = getAsyncStorage();
      if (AsyncStorage) {
        const v = await AsyncStorage.getItem(key);
        return v;
      }
    }
    return memory[key] ?? null;
  } catch {
    useMemory = true;
    return memory[key] ?? null;
  }
}

export async function storageSetItem(key: string, value: string): Promise<void> {
  if (useMemory) {
    memory[key] = value;
    return;
  }
  try {
    const available = await isAsyncStorageAvailable();
    if (available) {
      const AsyncStorage = getAsyncStorage();
      if (AsyncStorage) {
        await AsyncStorage.setItem(key, value);
        return;
      }
    }
  } catch {
    useMemory = true;
  }
  memory[key] = value;
}
