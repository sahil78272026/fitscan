import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import StreakScreen from './src/screens/StreakScreen';
import MealPlanScreen from './src/screens/MealPlanScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ScanMealScreen from './src/screens/ScanMealScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ user, onLogout }) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 20;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#E8A020',
        tabBarInactiveTintColor: '#A79A85',
        tabBarStyle: {
          backgroundColor: '#181410',
          borderTopColor: '#3A3128',
          borderTopWidth: 1,
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, focused }) => {
          let icon = '🏠';
          if (route.name === 'Today') icon = '🏠';
          else if (route.name === 'Streak') icon = '🔥';
          else if (route.name === 'Meals') icon = '📋';
          else if (route.name === 'Progress') icon = '📈';
          else if (route.name === 'Profile') icon = '👤';
          return <Text style={{ fontSize: 18 }}>{icon}</Text>;
        },
      })}
    >
      <Tab.Screen name="Today">
        {(props) => <HomeScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Streak" component={StreakScreen} />
      <Tab.Screen name="Meals" component={MealPlanScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const storedUser = await AsyncStorage.getItem('fitscan_user');
        const storedToken = await AsyncStorage.getItem('fitscan_token');
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.warn('Auth restore error:', e);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('fitscan_token');
    await AsyncStorage.removeItem('fitscan_user');
    setUser(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8A020" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#181410' },
          }}
        >
          {!user ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={setUser} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="MainApp">
                {(props) => <MainTabs {...props} user={user} onLogout={handleLogout} />}
              </Stack.Screen>
              <Stack.Screen name="Scan" component={ScanMealScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#181410',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
