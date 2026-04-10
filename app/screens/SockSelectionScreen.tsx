import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

export default function SockSelectionScreen() {
  const [sockType, setSockType] = useState('');
  const { footLength, footWidth, sport, gender } = useLocalSearchParams<{
    footLength: string;
    footWidth: string;
    sport: string;
    gender: string;
  }>();

  const handleNext = () => {
    router.push({
      pathname: '/screens/ResultScreen',
      params: {
        footLength,
        footWidth,
        sockType,
        sport,
        gender,
      },
    });
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Select Your Sock Type:</Text>

      <Picker
        selectedValue={sockType}
        onValueChange={(itemValue) => setSockType(itemValue)}
        style={{ marginVertical: 20 }}
      >
        <Picker.Item label="Select sock..." value="" color="#111" />
        <Picker.Item label="── Football ──" value="" color="#aaa" enabled={false} />
        <Picker.Item label="Nike Grip" value="nike_grip" color="#111" />
        <Picker.Item label="Trusox Midweight" value="trusox_mid" color="#111" />
        <Picker.Item label="Trusox Thin" value="trusox_thin" color="#111" />
        <Picker.Item label="Adidas Alphaskin" value="alphaskin" color="#111" />
        <Picker.Item label="Gain The Edge Grip" value="gain_the_edge" color="#111" />
        <Picker.Item label="TapeDesign Anti-Slip" value="tapedesign" color="#111" />
        <Picker.Item label="── Running ──" value="" color="#aaa" enabled={false} />
        <Picker.Item label="Darn Tough Element Micro Crew" value="darn_tough" color="#111" />
        <Picker.Item label="Smartwool Run Cold Weather" value="smartwool_run" color="#111" />
        <Picker.Item label="Injinji Ultra Run No-Show" value="injinji_ultra" color="#111" />
        <Picker.Item label="Inov-8 Active Mid" value="inov8_active" color="#111" />
        <Picker.Item label="Hilly Marathon Fresh" value="hilly_marathon" color="#111" />
        <Picker.Item label="Balega Hidden Comfort" value="balega_hidden" color="#111" />
        <Picker.Item label="Danish Endurance Running Sock" value="danish_endurance" color="#111" />
      </Picker>

      <Button title="Next" onPress={handleNext} disabled={!sockType} />
    </View>
  );
}
