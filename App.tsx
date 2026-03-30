import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import Purchases from 'react-native-purchases';

const REVENUECAT_ANDROID_KEY = 'test_RfAWfrXEEXKcYBoUPbjBEIqUKeZ';

function App(): React.JSX.Element {
  useEffect(() => {
    if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
