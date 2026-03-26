import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'FAVORITE_MEALS';

export interface FavoriteMeal {
  id: string;
  name: string;
  totalKcal: number;
  mealType: string;
  foods: { foodName: string; kcal: number }[];
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v) setFavorites(JSON.parse(v));
    });
  }, []);

  const save = async (next: FavoriteMeal[]) => {
    setFavorites(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  };

  const addFavorite = (meal: Omit<FavoriteMeal, 'id'>) =>
    save([...favorites, { ...meal, id: Date.now().toString() }]);

  const removeFavorite = (id: string) =>
    save(favorites.filter(f => f.id !== id));

  const isFavorite = (name: string) => favorites.some(f => f.name === name);

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
