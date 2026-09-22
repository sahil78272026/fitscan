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
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getWeightHistory, logWeight, deleteWeightLog, getSettings } from '../services/api';
import WeightTrendChart from '../components/WeightTrendChart';

export default function ProgressScreen() {
  const [weightInput, setWeightInput] = useState('');
  const [timeframe, setTimeframe] = useState(30);
  const [history, setHistory] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (days = timeframe) => {
    try {
      setLoading(true);
      const [histData, settingsData] = await Promise.all([
        getWeightHistory(days),
        getSettings(),
      ]);
      setHistory(histData);
      setUserSettings(settingsData);
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
    if (!w || w < 20 || w > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg (e.g. 74.5)');
      return;
    }

    setSubmitting(true);
    try {
      await logWeight(w);
      setWeightInput('');
      Alert.alert('Weight Saved ⚖️', `Logged ${w} kg`);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#E8A020" />
          <Text style={styles.loaderText}>Loading Progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const logs = history?.logs || [];
  const startWeight = history?.start_weight;
  const currentWeight = history?.current_weight || userSettings?.weight_kg || 75.0;
  const netChange = history?.net_change_kg;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.brandTitle}>📈 FitScan Progress</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(timeframe);
            }}
            tintColor="#E8A020"
          />
        }
      >
        {/* Weight Hero & Change Stats Box */}
        <View style={styles.heroCard}>
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
        </View>

        {/* Visual Weight Trend Bar Chart */}
        <WeightTrendChart
          logs={logs}
          currentTimeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
        />

        {/* Quick Log Weight Form */}
        <Text style={styles.sectionTitle}>⚖️ Log Weight Entry</Text>
        <View style={styles.card}>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter weight in kg (e.g. 74.5)"
              placeholderTextColor="#A79A85"
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveWeight} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#221803" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Weight Log History List */}
        <Text style={styles.sectionTitle}>📅 History (Past {timeframe} Days)</Text>
        <View style={styles.card}>
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
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteEntry(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
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
    backgroundColor: '#181410',
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
