import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import {
  estimateWidthFromLength,
  getEstimatedLengthMm,
  WidthProfile,
  SizeSystem,
} from '../../lib/fitting';
import { Palette, usePalette } from '../../lib/theme';

type InputMode = 'size' | 'manual';
type Sport = 'football' | 'running' | 'rugby';
type Gender = 'mens' | 'womens' | 'unisex' | 'kids';

function Chip({
  label,
  active,
  onPress,
  p,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  p: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: active ? p.ctaBg : p.chipBorder,
        backgroundColor: active ? p.ctaBg : p.card,
        borderRadius: 4,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? p.ctaText : p.text, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepLabel({ children, p }: { children: string; p: Palette }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '800', color: p.faint, letterSpacing: 1.5, marginBottom: 10, marginTop: 6 }}>
      {children}
    </Text>
  );
}

export default function ManualInputScreen() {
  const p = usePalette();
  const { sport, gender, footLength, footWidth } = useLocalSearchParams<{
    sport: Sport;
    gender: Gender;
    footLength?: string;
    footWidth?: string;
  }>();
  const prefilledLength = footLength ?? '';
  const prefilledWidth = footWidth ?? '';
  const hasPrefill = prefilledLength !== '' || prefilledWidth !== '';
  // Progressive: each step appears once the previous one is answered.
  const [inputMode, setInputMode] = useState<InputMode | null>(hasPrefill ? 'manual' : null);
  const [sizeSystem, setSizeSystem] = useState<SizeSystem | null>(null);
  const [shoeSize, setShoeSize] = useState('');
  const [widthProfile, setWidthProfile] = useState<WidthProfile>('standard');

  const [manualLength, setManualLength] = useState(prefilledLength);
  const [manualWidth, setManualWidth] = useState(prefilledWidth);

  const estimatedLength = useMemo(() => {
    if (inputMode !== 'size' || !sizeSystem) return 0;
    return getEstimatedLengthMm(sizeSystem, shoeSize, gender === 'kids');
  }, [inputMode, sizeSystem, shoeSize, gender]);

  const estimatedWidth = useMemo(() => {
    if (inputMode !== 'size') return 0;
    return estimateWidthFromLength(estimatedLength, widthProfile);
  }, [inputMode, estimatedLength, widthProfile]);

  const handleNext = () => {
    if (inputMode === 'manual') {
      const parsedManualLength = Number(manualLength);
      const parsedManualWidth = Number(manualWidth);

      if (!Number.isFinite(parsedManualLength) || !Number.isFinite(parsedManualWidth)) {
        Alert.alert('Missing measurements', 'Enter valid foot length and width in mm.');
        return;
      }

      router.push({
        pathname: '/screens/SockSelectionScreen',
        params: {
          footLength: String(parsedManualLength),
          footWidth: String(parsedManualWidth),
          sport,
          gender,
          widthProfile: '',
          measureSource: 'manual',
        },
      });

      return;
    }

    if (!sizeSystem || !shoeSize.trim()) {
      Alert.alert('Missing size', 'Pick a size system and enter your shoe size first.');
      return;
    }

    if (!estimatedLength || !estimatedWidth) {
      Alert.alert(
        'Unsupported size',
        `That ${sizeSystem} size is not in the current lookup table yet.`
      );
      return;
    }

    router.push({
      pathname: '/screens/SockSelectionScreen',
      params: {
        footLength: String(estimatedLength),
        footWidth: String(estimatedWidth),
        sport,
        gender,
        widthProfile,
        measureSource: 'estimated',
      },
    });
  };

  const showNext =
    inputMode === 'manual' ||
    (inputMode === 'size' && sizeSystem !== null && shoeSize.trim() !== '');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ padding: 20, flex: 1 }}>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/screens/ScannerScreen',
                  params: { sport: sport ?? '', gender: gender ?? '' },
                });
              }}
              style={({ pressed }) => ({
                backgroundColor: p.heroBg,
                borderWidth: 1,
                borderColor: p.heroBorder,
                borderRadius: 16,
                padding: 18,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 }}>
                  SCAN YOUR FEET
                </Text>
                <Text style={{ color: '#888', fontSize: 12 }}>
                  Phone camera + a sheet of A4 — accurate to the millimetre
                </Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>→</Text>
            </Pressable>

            <StepLabel p={p}>OR ENTER IT YOURSELF</StepLabel>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip p={p} label="SHOE SIZE" active={inputMode === 'size'} onPress={() => setInputMode('size')} />
              <Chip p={p} label="EXACT MM" active={inputMode === 'manual'} onPress={() => setInputMode('manual')} />
            </View>

            {inputMode === 'size' && (
              <>
                <StepLabel p={p}>SIZE SYSTEM</StepLabel>

                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <Chip p={p} label="UK" active={sizeSystem === 'UK'} onPress={() => setSizeSystem('UK')} />
                  <Chip p={p} label="EU" active={sizeSystem === 'EU'} onPress={() => setSizeSystem('EU')} />
                  <Chip p={p} label="US" active={sizeSystem === 'US'} onPress={() => setSizeSystem('US')} />
                </View>

                {sizeSystem !== null && (
                  <>
                    <StepLabel p={p}>{`YOUR ${sizeSystem} SIZE`}</StepLabel>

                    <TextInput
                      value={shoeSize}
                      onChangeText={setShoeSize}
                      placeholder={
                        gender === 'kids'
                          ? sizeSystem === 'EU' ? 'e.g. 33' : 'e.g. 12 or 2.5'
                          : sizeSystem === 'UK' ? 'e.g. 8.5' : sizeSystem === 'US' ? 'e.g. 9.5' : 'e.g. 43'
                      }
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      placeholderTextColor={p.faint}
                      style={{
                        color: p.text,
                        borderWidth: 1,
                        borderColor: p.chipBorder,
                        backgroundColor: p.card,
                        borderRadius: 4,
                        padding: 14,
                        fontSize: 18,
                        fontWeight: '700',
                        marginBottom: gender === 'kids' ? 6 : 16,
                      }}
                    />
                    {gender === 'kids' && (
                      <Text style={{ fontSize: 12, color: p.muted, lineHeight: 17, marginBottom: 16 }}>
                        Kids sizes: 10–13.5 are child sizes, 1–5.5 are junior sizes.
                      </Text>
                    )}

                    <StepLabel p={p}>HOW DO YOUR FEET FEEL IN SHOES?</StepLabel>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                      <Chip p={p} label="NARROW" active={widthProfile === 'narrow'} onPress={() => setWidthProfile('narrow')} />
                      <Chip p={p} label="STANDARD" active={widthProfile === 'standard'} onPress={() => setWidthProfile('standard')} />
                      <Chip p={p} label="WIDE" active={widthProfile === 'wide'} onPress={() => setWidthProfile('wide')} />
                    </View>

                    {estimatedLength > 0 && estimatedWidth > 0 && (
                      <View style={{
                        backgroundColor: p.heroBg,
                        borderWidth: 1,
                        borderColor: p.heroBorder,
                        borderRadius: 16,
                        padding: 18,
                        marginTop: 8,
                        marginBottom: 8,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1.5, marginBottom: 6 }}>
                          YOUR ESTIMATED FEET
                        </Text>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 }}>
                          {estimatedLength} × {estimatedWidth}
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#888' }}>  mm</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: '#888', lineHeight: 17 }}>
                          Estimated from your shoe size — scan with your phone for exact numbers.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {inputMode === 'manual' && (
              <>
                <StepLabel p={p}>FOOT LENGTH (MM)</StepLabel>
                <TextInput
                  value={manualLength}
                  onChangeText={setManualLength}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  placeholderTextColor={p.faint}
                  placeholder="e.g. 260"
                  style={{
                    color: p.text,
                    borderWidth: 1,
                    borderColor: p.chipBorder,
                    backgroundColor: p.card,
                    borderRadius: 4,
                    padding: 14,
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 16,
                  }}
                />

                <StepLabel p={p}>FOOT WIDTH (MM)</StepLabel>
                <TextInput
                  value={manualWidth}
                  onChangeText={setManualWidth}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  placeholderTextColor={p.faint}
                  placeholder="e.g. 95"
                  style={{
                    color: p.text,
                    borderWidth: 1,
                    borderColor: p.chipBorder,
                    backgroundColor: p.card,
                    borderRadius: 4,
                    padding: 14,
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 16,
                  }}
                />
              </>
            )}

            {showNext && (
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => ({
                  backgroundColor: p.ctaBg,
                  borderRadius: 999,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginTop: 8,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text style={{ color: p.ctaText, fontSize: 15, fontWeight: '700' }}>Next</Text>
              </Pressable>
            )}

          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
