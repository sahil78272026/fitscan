import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';

// Keep the native splash screen visible while loading resources and verifying auth state
SplashScreen.preventAutoHideAsync().catch(() => {});

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from './src/services/firebase';
import { getMe } from './src/services/api';
import { colors, typography } from './src/theme';

let GoogleSignin = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch (e) {
  // Gracefully fallback when running inside Expo Go
}

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import MealPlanScreen from './src/screens/MealPlanScreen';
import StoreScreen from './src/screens/StoreScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ScanMealScreen from './src/screens/ScanMealScreen';
import ActivityDetailScreen from './src/screens/ActivityDetailScreen';
import StreakScreen from './src/screens/StreakScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ user, onLogout }) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 12;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary || '#E8A020',
        tabBarInactiveTintColor: colors.textSecondary || '#A79A85',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.background || '#181410',
          borderTopColor: colors.border || '#3A3128',
          borderTopWidth: 1,
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: typography?.sizes?.xs || 11,
          fontWeight: '600',
          fontFamily: typography?.fontFamily,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'Profile' && user?.avatar_url) {
            return (
              <Image
                source={{ uri: user.avatar_url }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: focused ? 1.5 : 1,
                  borderColor: focused ? (colors.primary || '#E8A020') : '#5A4C3D',
                }}
              />
            );
          }
          let icon = '🍽️';
          if (route.name === 'Today') icon = '🍽️';
          else if (route.name === 'Meals') icon = '📋';
          else if (route.name === 'Store') icon = '🛍️';
          else if (route.name === 'Progress') icon = '📊';
          else if (route.name === 'Profile') icon = '👤';
          return (
            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, textAlign: 'center', includeFontPadding: false }}>{icon}</Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Today">
        {(props) => <HomeScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Meals" component={MealPlanScreen} />
      <Tab.Screen name="Store" component={StoreScreen} />
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
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          // Background refresh to pick up avatar or updated profile
          getMe()
            .then((fresh) => {
              if (fresh && fresh.id) {
                setUser(fresh);
                AsyncStorage.setItem('fitscan_user', JSON.stringify(fresh));
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        console.warn('Auth restore error:', e);
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      if (GoogleSignin && typeof GoogleSignin.signOut === 'function') {
        await GoogleSignin.signOut();
      }
    } catch (e) {
      console.warn('Google sign out error:', e);
    }

    try {
      if (auth && typeof auth.signOut === 'function') {
        await auth.signOut();
      }
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }

    await AsyncStorage.removeItem('fitscan_token');
    await AsyncStorage.removeItem('fitscan_user');
    setUser(null);
  };

  if (loading) {
    return null;
  }

  return (
    <ErrorBoundary>
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
                <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
                <Stack.Screen name="Streak" component={StreakScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
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
