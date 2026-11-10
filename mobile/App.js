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
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { auth } from './src/services/firebase';
import { getMe } from './src/services/api';
import { colors, typography, shadows } from './src/theme';

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

// Zero-Emoji Vector SVG Tab Icons
function TodayTabIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 11v11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 2v4a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 9v13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MealsTabIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="8" y="2" width="8" height="4" rx="1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 12h6M9 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StoreTabIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 10a4 4 0 0 1-8 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProgressTabIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="20" x2="18" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="20" x2="12" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="6" y1="20" x2="6" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProfileTabIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MainTabs({ user, onLogout }) {
  const insets = useSafeAreaInsets();
  const bottomMargin = Platform.select({
    ios: Math.max(insets.bottom, 16),
    android: insets.bottom > 0 ? insets.bottom + 8 : 16,
    default: 16,
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary || '#F59E0B',
        tabBarInactiveTintColor: colors.textSecondary || '#94A3B8',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: bottomMargin,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(17, 19, 24, 0.94)',
          borderWidth: 1,
          borderColor: colors.border || '#222631',
          borderTopWidth: 1,
          borderTopColor: colors.border || '#222631',
          paddingBottom: 6,
          paddingTop: 6,
          ...(shadows?.floatingBar || Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.50,
              shadowRadius: 16.0,
            },
            android: {
              elevation: 12,
            },
            default: {
              elevation: 12,
            },
          })),
        },
        tabBarLabelStyle: {
          fontSize: typography?.sizes?.xs || 11,
          fontWeight: '600',
          fontFamily: typography?.fontFamily,
          marginBottom: 3,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        tabBarIcon: ({ color, focused }) => {
          const iconColor = focused ? (colors.primary || '#F59E0B') : (colors.textSecondary || '#94A3B8');
          let iconElement = null;

          if (route.name === 'Profile' && user?.avatar_url) {
            iconElement = (
              <Image
                source={{ uri: user.avatar_url }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: focused ? 1.5 : 1,
                  borderColor: focused ? (colors.primary || '#F59E0B') : (colors.border || '#222631'),
                }}
              />
            );
          } else if (route.name === 'Today') {
            iconElement = <TodayTabIcon color={iconColor} size={20} />;
          } else if (route.name === 'Meals') {
            iconElement = <MealsTabIcon color={iconColor} size={20} />;
          } else if (route.name === 'Store') {
            iconElement = <StoreTabIcon color={iconColor} size={20} />;
          } else if (route.name === 'Progress') {
            iconElement = <ProgressTabIcon color={iconColor} size={20} />;
          } else if (route.name === 'Profile') {
            iconElement = <ProfileTabIcon color={iconColor} size={20} />;
          }

          return (
            <View
              style={[
                styles.tabIconCapsule,
                focused && styles.tabIconCapsuleActive,
              ]}
            >
              {iconElement}
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
              contentStyle: { backgroundColor: colors.background || '#08090C' },
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
    backgroundColor: colors.background || '#08090C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconCapsule: {
    width: 40,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabIconCapsuleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.30,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {
        elevation: 2,
      },
    }),
  },
});
