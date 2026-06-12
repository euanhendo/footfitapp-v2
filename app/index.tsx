import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createFitProfileStore, StorageAdapter } from '../lib/fitProfile';

const storage: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const profileStore = createFitProfileStore(storage);

// Branded splash: FOOTFIT in block letters with a colour wave rolling through
// them (the app's accent palette), held for a beat, then faded out.
const LETTERS = ['F', 'O', 'O', 'T', 'F', 'I', 'T'];
const WAVE_COLORS = ['#ffffff', '#1a6bb5', '#2a8a3a', '#b55a1a', '#ffffff'];
const LETTER_STAGGER_MS = 140;
const WAVE_CYCLE_MS = 1600;
const SPLASH_MIN_MS = 2200;
const EXIT_FADE_MS = 350;

function SplashLetter({ letter, index }: { letter: string; index: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Colour interpolation can't run on the native driver; this is splash-only.
    const wave = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: WAVE_CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    const timer = setTimeout(() => wave.start(), index * LETTER_STAGGER_MS);
    return () => {
      clearTimeout(timer);
      wave.stop();
    };
  }, [t, index]);

  const color = t.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: WAVE_COLORS,
  });

  return (
    <Animated.Text
      style={{
        fontSize: 46,
        fontWeight: '900',
        letterSpacing: 6,
        color,
        textShadowColor: '#2e2e2e',
        textShadowOffset: { width: 3, height: 3 },
        textShadowRadius: 0,
      }}
    >
      {letter}
    </Animated.Text>
  );
}

export default function Index() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [minElapsed, setMinElapsed] = useState(false);
  const [exited, setExited] = useState(false);
  const exitFade = useRef(new Animated.Value(1)).current;
  const barFill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    profileStore.load().then((profile) => setHasProfile(profile !== null));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    Animated.timing(barFill, {
      toValue: 1,
      duration: SPLASH_MIN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    return () => clearTimeout(timer);
  }, [barFill]);

  useEffect(() => {
    if (hasProfile === null || !minElapsed || exited) return;
    Animated.timing(exitFade, {
      toValue: 0,
      duration: EXIT_FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setExited(true);
    });
  }, [hasProfile, minElapsed, exited, exitFade]);

  if (exited && hasProfile !== null) {
    return <Redirect href={hasProfile ? '/screens/HomeScreen' : '/screens/WelcomeScreen'} />;
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: exitFade,
      }}
    >
      <View style={{ flexDirection: 'row', marginBottom: 18 }}>
        {LETTERS.map((letter, i) => (
          <SplashLetter key={`${letter}-${i}`} letter={letter} index={i} />
        ))}
      </View>
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 3, marginBottom: 22 }}>
        FIND YOUR FIT
      </Text>
      <View style={{ width: 140, height: 3, borderRadius: 2, backgroundColor: '#2e2e2e', overflow: 'hidden' }}>
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: '#fff',
            width: barFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
    </Animated.View>
  );
}
