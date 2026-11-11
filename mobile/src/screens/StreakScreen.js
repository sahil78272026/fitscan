import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography } from '../theme';
import { ScreenHeader } from '../components/ui';
import { getAdherenceStats } from '../services/api';
import AdherenceCard from '../components/AdherenceCard';

export default function StreakScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdherenceStats();
      setStats(res);
    } catch (err) {
      console.warn('StreakScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScreenHeader
          title="Streak & Achievements"
          onBack={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate('MainApp'))}
          backTitle="Back"
          backIcon="←"
        />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary || '#E8A020'} />
          <Text style={styles.loaderText}>Loading Streak Stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title="Streak & Achievements"
        onBack={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate('MainApp'))}
        backTitle="Back"
        backIcon="←"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStats();
            }}
            tintColor={colors.primary || '#E8A020'}
          />
        }
      >
        {/* Main Adherence & Badges Card */}
        <AdherenceCard stats={stats} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#08090C',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: colors.textSecondary || '#A79A85',
    fontSize: typography?.sizes?.sm || 14,
    marginTop: 10,
  },
  scroll: {
    padding: 16,
  },
});
