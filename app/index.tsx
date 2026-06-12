import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createFitProfileStore, StorageAdapter } from '../lib/fitProfile';

const storage: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const profileStore = createFitProfileStore(storage);

export default function Index() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    profileStore.load().then((profile) => setHasProfile(profile !== null));
  }, []);

  if (hasProfile === null) return null;
  return <Redirect href={hasProfile ? '/screens/HomeScreen' : '/screens/WelcomeScreen'} />;
}
