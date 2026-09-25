import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

// expo-secure-store (Keychain/Keystore) doesn't work on web -- fall back to
// localStorage there. Session tokens are the only thing persisted here, so
// AsyncStorage (plaintext) isn't used on native.
// Mirrors mobile/src/services/secureStorage.ts exactly.
export const secureStorage: StateStorage = {
  getItem: async (name: string) => {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(name) : null;
    }
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(name, value);
      return;
    }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(name);
      return;
    }
    await SecureStore.deleteItemAsync(name);
  },
};
