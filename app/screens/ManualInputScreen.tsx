import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

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

function SelectButton({
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
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: active ? p.ctaBg : p.chipBorder,
        backgroundColor: active ? p.ctaBg : p.card,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? p.ctaText : p.text, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
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
  const [inputMode, setInputMode] = useState<InputMode>(hasPrefill ? 'manual' : 'size');
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>('UK');
  const [shoeSize, setShoeSize] = useState('');
  const [widthProfile, setWidthProfile] = useState<WidthProfile>('standard');

  const [manualLength, setManualLength] = useState(prefilledLength);
  const [manualWidth, setManualWidth] = useState(prefilledWidth);

  const estimatedLength = useMemo(() => {
    if (inputMode !== 'size') return 0;
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

    if (!shoeSize.trim()) {
      Alert.alert('Missing size', `Enter your ${sizeSystem} shoe size first.`);
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ padding: 20, flex: 1 }}>

            <Text style={{ fontSize: 24, fontWeight: '700', color: p.text, marginBottom: 8 }}>
              Measure your feet
            </Text>

            <Text style={{ fontSize: 15, color: p.muted, marginBottom: 12 }}>
              Choose the easiest way to get your boot fit.
            </Text>

            <Pressable
              onPress={() => router.push('/screens/MeasureGuideScreen')}
              style={{ marginBottom: 16 }}
            >
              <Text style={{ fontSize: 13, color: p.muted, textDecorationLine: 'underline' }}>
                Not sure how to measure? Open guide →
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/screens/ScannerScreen',
                  params: { sport: sport ?? '', gender: gender ?? '' },
                })
              }
              style={{
                backgroundColor: p.heroBg,
                borderWidth: 1,
                borderColor: p.heroBorder,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                Scan with your phone
              </Text>
              <Text style={{ color: '#bbb', fontSize: 12, marginTop: 3 }}>
                Stand on A4 paper against a wall — measures your foot in mm automatically
              </Text>
            </Pressable>

            <Text style={{ fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 10 }}>
              Input method
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              <SelectButton p={p} label="Shoe size" active={inputMode === 'size'} onPress={() => setInputMode('size')} />
              <SelectButton p={p} label="Advanced manual" active={inputMode === 'manual'} onPress={() => setInputMode('manual')} />
            </View>

            {inputMode === 'size' && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 10 }}>
                  Size system
                </Text>

                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                  <SelectButton p={p} label="UK" active={sizeSystem === 'UK'} onPress={() => setSizeSystem('UK')} />
                  <SelectButton p={p} label="EU" active={sizeSystem === 'EU'} onPress={() => setSizeSystem('EU')} />
                  <SelectButton p={p} label="US" active={sizeSystem === 'US'} onPress={() => setSizeSystem('US')} />
                </View>

                <Text style={{ fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 6 }}>
                  Enter your {sizeSystem} size
                </Text>

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
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: gender === 'kids' ? 6 : 16,
                  }}
                />
                {gender === 'kids' && (
                  <Text style={{ fontSize: 12, color: p.muted, lineHeight: 17, marginBottom: 16 }}>
                    Kids sizes: 10–13.5 are child sizes, 1–5.5 are junior sizes.
                  </Text>
                )}

                <Text style={{ fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 10 }}>
                  Foot width feel
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
                  <SelectButton p={p} label="Narrow" active={widthProfile === 'narrow'} onPress={() => setWidthProfile('narrow')} />
                  <SelectButton p={p} label="Standard" active={widthProfile === 'standard'} onPress={() => setWidthProfile('standard')} />
                  <SelectButton p={p} label="Wide" active={widthProfile === 'wide'} onPress={() => setWidthProfile('wide')} />
                </View>

                <View style={{
                  backgroundColor: p.panel,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 20,
                }}>
                  <Text style={{ fontWeight: '700', color: p.text, marginBottom: 6 }}>
                    Estimated measurements
                  </Text>
                  <Text style={{ color: p.text }}>Estimated foot length: {estimatedLength || '-'} mm</Text>
                  <Text style={{ color: p.text }}>Estimated foot width: {estimatedWidth || '-'} mm</Text>
                  <Text style={{ marginTop: 8, color: p.muted, fontSize: 13 }}>
                    This is a size-based estimate. Use Advanced manual for exact mm.
                  </Text>
                </View>
              </>
            )}

            {inputMode === 'manual' && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 6 }}>
                  Foot length (mm)
                </Text>
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
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 6 }}>
                  Foot width (mm)
                </Text>
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
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 20,
                  }}
                />
              </>
            )}

            <Pressable
              onPress={handleNext}
              style={{ backgroundColor: p.ctaBg, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: p.ctaText, fontSize: 15, fontWeight: '700' }}>Next</Text>
            </Pressable>

          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
