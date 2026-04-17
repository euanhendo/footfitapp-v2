import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import {
  Alert,
  Button,
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

type InputMode = 'size' | 'manual';
type Sport = 'football' | 'running' | 'rugby';
type Gender = 'mens' | 'womens' | 'unisex';

function SelectButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: active ? '#111' : '#ccc',
        backgroundColor: active ? '#111' : '#fff',
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? '#fff' : '#111', fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ManualInputScreen() {
  const { sport, gender } = useLocalSearchParams<{ sport: Sport; gender: Gender }>();
  const [inputMode, setInputMode] = useState<InputMode>('size');
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>('UK');
  const [shoeSize, setShoeSize] = useState('');
  const [widthProfile, setWidthProfile] = useState<WidthProfile>('standard');

  const [manualLength, setManualLength] = useState('');
  const [manualWidth, setManualWidth] = useState('');

  const estimatedLength = useMemo(() => {
    if (inputMode !== 'size') return 0;
    return getEstimatedLengthMm(sizeSystem, shoeSize);
  }, [inputMode, sizeSystem, shoeSize]);

  const estimatedWidth = useMemo(() => {
    if (inputMode !== 'size') return 0;
    return estimateWidthFromLength(estimatedLength, widthProfile);
  }, [inputMode, estimatedLength, widthProfile]);

  const handleScanPress = () => {
    Alert.alert(
      'Scan coming next',
      'Next version: phone camera scan with on-screen guidance and exact foot measurement.'
    );
  };

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

            <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
              Measure your feet
            </Text>

            <Text style={{ fontSize: 15, color: '#555', marginBottom: 12 }}>
              Choose the easiest way to get your boot fit.
            </Text>

            <Pressable
              onPress={() => router.push('/screens/MeasureGuideScreen')}
              style={{ marginBottom: 16 }}
            >
              <Text style={{ fontSize: 13, color: '#666', textDecorationLine: 'underline' }}>
                Not sure how to measure? Open guide →
              </Text>
            </Pressable>

            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
              Input method
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              <SelectButton label="Shoe size" active={inputMode === 'size'} onPress={() => setInputMode('size')} />
              <SelectButton label="Advanced manual" active={inputMode === 'manual'} onPress={() => setInputMode('manual')} />
              <SelectButton label="Scan with phone" active={false} onPress={handleScanPress} />
            </View>

            {inputMode === 'size' && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
                  Size system
                </Text>

                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                  <SelectButton label="UK" active={sizeSystem === 'UK'} onPress={() => setSizeSystem('UK')} />
                  <SelectButton label="EU" active={sizeSystem === 'EU'} onPress={() => setSizeSystem('EU')} />
                  <SelectButton label="US" active={sizeSystem === 'US'} onPress={() => setSizeSystem('US')} />
                </View>

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                  Enter your {sizeSystem} size
                </Text>

                <TextInput
                  value={shoeSize}
                  onChangeText={setShoeSize}
                  placeholder={sizeSystem === 'UK' ? 'e.g. 8.5' : sizeSystem === 'US' ? 'e.g. 9.5' : 'e.g. 43'}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
                  Foot width feel
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
                  <SelectButton label="Narrow" active={widthProfile === 'narrow'} onPress={() => setWidthProfile('narrow')} />
                  <SelectButton label="Standard" active={widthProfile === 'standard'} onPress={() => setWidthProfile('standard')} />
                  <SelectButton label="Wide" active={widthProfile === 'wide'} onPress={() => setWidthProfile('wide')} />
                </View>

                <View style={{
                  backgroundColor: '#f5f5f5',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 20,
                }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>
                    Estimated measurements
                  </Text>
                  <Text>Estimated foot length: {estimatedLength || '-'} mm</Text>
                  <Text>Estimated foot width: {estimatedWidth || '-'} mm</Text>
                  <Text style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                    This is a size-based estimate. Camera scan will be more accurate.
                  </Text>
                </View>
              </>
            )}

            {inputMode === 'manual' && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                  Foot length (mm)
                </Text>
                <TextInput
                  value={manualLength}
                  onChangeText={setManualLength}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  placeholder="e.g. 260"
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                  Foot width (mm)
                </Text>
                <TextInput
                  value={manualWidth}
                  onChangeText={setManualWidth}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  placeholder="e.g. 95"
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 20,
                  }}
                />
              </>
            )}

            <Button title="Next" onPress={handleNext} />

          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
