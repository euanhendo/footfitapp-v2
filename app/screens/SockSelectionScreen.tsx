import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { getSocksForSport, SockEntry } from '../../lib/fitting';
import sockDatabase from '../../sockDatabase.json';

type SockDb = Record<string, SockEntry>;
const socks = sockDatabase as SockDb;

export default function SockSelectionScreen() {
  const [sockType, setSockType] = useState('');
  const { footLength, footWidth, sport, gender } = useLocalSearchParams<{
    footLength: string;
    footWidth: string;
    sport: string;
    gender: string;
  }>();

  const sockOptions = getSocksForSport(socks, sport ?? '');

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
        {sockOptions.map((sock) => (
          <Picker.Item
            key={sock.key}
            label={`${sock.brand} (+${sock.thickness}mm)`}
            value={sock.key}
            color="#111"
          />
        ))}
      </Picker>

      <Button title="Next" onPress={handleNext} disabled={!sockType} />
    </View>
  );
}
