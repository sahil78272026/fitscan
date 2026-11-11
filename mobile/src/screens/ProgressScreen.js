import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { ScreenHeader, Card, Button } from '../components/ui';
import { getWeightHistory, logWeight, deleteWeightLog, getSettings, getAdherenceStats } from '../services/api';
import WeightTrendChart from '../components/WeightTrendChart';
import AdherenceCard from '../components/AdherenceCard';

export default function ProgressScreen() {
  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState('');
  const [timeframe, setTimeframe] = useState(30);
  const [history, setHistory] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [adherenceStats, setAdherenceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (days = timeframe) => {
    try {
      setLoading(true);
      const [histData, settingsData, statsData] = await Promise.all([
        getWeightHistory(days).catch((e) => { console.warn('Weight history error:', e); return null; }),
        getSettings().catch((e) => { console.warn('Settings error:', e); return null; }),
        getAdherenceStats().catch((e) => { console.warn('Adherence stats error:', e); return null; }),
      ]);
      if (histData) setHistory(histData);
      if (settingsData) setUserSettings(settingsData);
      if (statsData) setAdherenceStats(statsData);
    } catch (err) {
      console.warn('ProgressScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe]);

  useFocusEffect(
    useCallback(() => {
      loadData(timeframe);
    }, [loadData, timeframe])
  );

  const handleTimeframeChange = (days) => {
    setTimeframe(days);
    loadData(days);
  };

  const handleSaveWeight = async () => {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 25 || w > 300) {
      setWeightError('Weight must be between 25 and 300 kg');
      return;
    }
    setWeightError('');

    setSubmitting(true);
    try {
      await logWeight(w);
      setWeightInput('');
      Alert.alert('Weight Saved', `Logged ${w} kg`);
      await loadData(timeframe);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to log weight');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (logId) => {
    Alert.alert('Delete Entry', 'Are you sure you want to remove this weight entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWeightLog(logId);
            await loadData(timeframe);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete weight entry');
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary || '#E8A020'} />
          <Text style={styles.loaderText}>Loading Progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rawLogs = history?.logs || [];
  const logs = rawLogs.filter((item) => item.weight_kg >= 25 && item.weight_kg <= 300);
  const startWeight =
    history?.start_weight >= 25 && history?.start_weight <= 300
      ? history.start_weight
      : logs.length > 0
      ? logs[0].weight_kg
      : null;
  const currentWeight =
    history?.current_weight >= 25 && history?.current_weight <= 300
      ? history.current_weight
      : logs.length > 0
      ? logs[logs.length - 1].weight_kg
      : (userSettings?.weight_kg || 75.0);
  const netChange =
    startWeight !== null && currentWeight !== null
      ? +(currentWeight - startWeight).toFixed(1)
      : history?.net_change_kg;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title="Progress & Adherence"
        subtitle="Weight Trend & Habit Analytics"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(timeframe);
            }}
            tintColor={colors.primary || '#E8A020'}
          />
        }
      >
        {/* Streak & Adherence Stats Card */}
        <AdherenceCard stats={adherenceStats} />

        {/* Weight Progress & Targets Section */}
        <Text style={styles.sectionTitle}>Weight Trend & Targets</Text>

        {/* Weight Hero & Change Stats Box */}
        <Card variant="default" style={styles.heroCard}>
          <Text style={styles.heroLabel}>CURRENT WEIGHT</Text>
          <View style={styles.weightDisplayRow}>
            <Text style={styles.weightVal}>{currentWeight}</Text>
            <Text style={styles.weightUnit}>kg</Text>
          </View>
          <Text style={styles.heroSubtext}>
            Goal: {(userSettings?.goal_type || 'fat_loss').replace('_', ' ')} • target ~0.4 kg / week
          </Text>

          {/* 3 Metrics: Start | Current | Net Change */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Start</Text>
              <Text style={styles.statVal}>{startWeight ? `${startWeight} kg` : '--'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={styles.statVal}>{currentWeight ? `${currentWeight} kg` : '--'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Net Change</Text>
              <Text
                style={[
                  styles.statVal,
                  netChange < 0 && styles.lossText,
                  netChange > 0 && styles.gainText,
                ]}
              >
                {netChange !== null && netChange !== undefined
                  ? `${netChange > 0 ? '+' : ''}${netChange} kg`
                  : '--'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Visual Weight Trend Curve Chart */}
        <WeightTrendChart
          logs={logs}
          currentTimeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          targetWeight={userSettings?.target_weight}
        />

        {/* Quick Log Weight Form */}
        <Text style={styles.sectionTitle}>Log Weight Entry</Text>
        <Card variant="default" style={styles.card}>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter weight in kg (e.g. 74.5)"
              placeholderTextColor={colors.textSecondary || '#A79A85'}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={(t) => {
                setWeightInput(t);
                if (weightError) setWeightError('');
              }}
            />
            <Button
              title="Save"
              onPress={handleSaveWeight}
              loading={submitting}
              variant="primary"
              size="md"
              style={styles.saveBtn}
            />
          </View>
          {weightError ? (
            <Text style={{ color: colors.dangerText || '#E57453', fontSize: 12, marginTop: 6 }}>{weightError}</Text>
          ) : null}
        </Card>

        {/* Weight Log History List */}
        <Text style={styles.sectionTitle}>History (Past {timeframe} Days)</Text>
        <Card variant="default" style={styles.card}>
          {logs.length === 0 ? (
            <Text style={styles.emptyText}>No weight entries logged for this timeframe.</Text>
          ) : (
            logs
              .slice()
              .reverse()
              .map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyDate}>{item.logged_date}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyVal}>{item.weight_kg} kg</Text>
                    <Button
                      title="Delete"
                      onPress={() => handleDeleteEntry(item.id)}
                      variant="ghost"
                      size="sm"
                      textStyle={{ color: colors.dangerText || '#E57453', fontSize: 13 }}
                    />
                  </View>
                </View>
              ))
          )}
        </Card>
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
    color: '#A79A85',
    fontSize: 14,
    marginTop: 10,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#221D17',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  scroll: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A79A85',
    letterSpacing: 1,
    marginBottom: 6,
  },
  weightDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  weightVal: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  weightUnit: {
    fontSize: 18,
    color: '#A79A85',
  },
  heroSubtext: {
    fontSize: 12,
    color: '#A79A85',
    marginTop: 4,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#2D261F',
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#A79A85',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  lossText: {
    color: '#3fb950',
  },
  gainText: {
    color: '#f85149',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  weightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: '#08090C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    padding: 12,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#A79A85',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C251D',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyDate: {
    fontSize: 14,
    color: '#A79A85',
  },
  historyVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  deleteBtn: {
    padding: 4,
  },
  deleteText: {
    fontSize: 14,
  },
});
