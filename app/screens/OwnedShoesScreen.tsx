import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Boot } from '../../lib/fitting';
import { StorageAdapter } from '../../lib/fitProfile';
import { createOwnedShoesStore, FitRating, OwnedShoe } from '../../lib/ownedShoes';
import bootDatabase from '../../bootDatabase.json';

const boots = bootDatabase as Boot[];

const storage: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const ownedStore = createOwnedShoesStore(storage);

export default function OwnedShoesScreen() {
  const { gender } = useLocalSearchParams<{ gender?: string }>();
  const [owned, setOwned] = useState<OwnedShoe[]>([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    ownedStore.load().then(setOwned);
  }, []);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ownedKeys = new Set(owned.map((s) => `${s.brand}|${s.model}|${s.gender}`));
    return boots
      .filter((b) => !gender || b.gender === gender || b.gender === 'unisex')
      .filter((b) => !ownedKeys.has(`${b.brand}|${b.model}|${b.gender}`))
      .filter((b) => {
        if (!q) return true;
        return (
          b.brand.toLowerCase().includes(q) ||
          b.model.toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [query, owned, gender]);

  const handleAdd = async (boot: Boot) => {
    const next = await ownedStore.add({
      brand: boot.brand,
      model: boot.model,
      gender: boot.gender,
    });
    setOwned(next);
    setAdding(false);
    setQuery('');
  };

  const handleRemove = async (shoe: OwnedShoe) => {
    const next = await ownedStore.remove(shoe);
    setOwned(next);
  };

  const handleRate = async (shoe: OwnedShoe, rating: FitRating) => {
    const nextRating = shoe.fitRating === rating ? null : rating;
    const next = await ownedStore.rate(shoe, nextRating);
    setOwned(next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 4 }}>
          My shoes
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
          Tag shoes you own and love — we&apos;ll favour similar fits in your matches.
        </Text>

        {!adding && (
          <>
            {owned.length > 0 && (
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                Tap how each pair fits — we&apos;ll adjust brand recommendations for you.
              </Text>
            )}
            <FlatList
              data={owned}
              keyExtractor={(item) => `${item.brand}-${item.model}-${item.gender}`}
              ListEmptyComponent={
                <Text style={{ color: '#999', fontSize: 14, marginTop: 20 }}>
                  No shoes added yet.
                </Text>
              }
              renderItem={({ item }) => (
                <View style={{
                  backgroundColor: '#fff',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: '#ebebeb',
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>
                        {item.brand} {item.model}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        {item.gender === 'mens' ? "Men's" : item.gender === 'womens' ? "Women's" : 'Unisex'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemove(item)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                    >
                      <Text style={{ color: '#b55a1a', fontSize: 13, fontWeight: '700' }}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
                    {(['tight', 'true', 'loose'] as FitRating[]).map((rating) => {
                      const selected = item.fitRating === rating;
                      return (
                        <Pressable
                          key={rating}
                          onPress={() => handleRate(item, rating)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: selected ? '#111' : '#ebebeb',
                            backgroundColor: selected ? '#111' : '#fff',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: selected ? '#fff' : '#666',
                            textTransform: 'capitalize',
                          }}>
                            {rating === 'true' ? 'True to size' : rating}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            />
            <Pressable
              onPress={() => setAdding(true)}
              style={{
                backgroundColor: '#111',
                borderRadius: 10,
                padding: 14,
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                Add a shoe
              </Text>
            </Pressable>
          </>
        )}

        {adding && (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by brand or model"
              placeholderTextColor="#999"
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#e8e8e8',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                marginBottom: 12,
              }}
            />
            <FlatList
              data={candidates}
              keyExtractor={(item) => `${item.brand}-${item.model}-${item.gender}`}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleAdd(item)}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: '#ebebeb',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>
                    {item.brand} {item.model}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                    {item.gender === 'mens' ? "Men's" : item.gender === 'womens' ? "Women's" : 'Unisex'} · {item.width} fit
                  </Text>
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => { setAdding(false); setQuery(''); }}
              style={{ alignItems: 'center', marginTop: 10, padding: 10 }}
            >
              <Text style={{ color: '#666', fontSize: 13, textDecorationLine: 'underline' }}>
                Cancel
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
