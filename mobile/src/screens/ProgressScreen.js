import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWeightHistory, logWeight, getSettings } from '../services/api';

export default function ProgressScreen() {
  const [weightInput, setWeightInput] = useState('');
  const [history, setHistory] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [histData, settingsData] = await Promise.all([
        getWeightHistory(30),
        getSettings(),
      ]);
      setHistory(histData);
      setUserSettings(settingsData);
    } catch (err) {
      console.warn('ProgressScreen load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to log weight');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#E8A020" />
          <Text style={styles.loaderText}>Loading Progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const latestWeight = history?.entries?.[0]?.weight_kg || userSettings?.weight_kg || 75.0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.brandTitle}>FitScan Progress</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Weight Hero Box */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>CURRENT WEIGHT</Text>
          <View style={styles.weightDisplayRow}>
            <Text style={styles.weightVal}>{latestWeight}</Text>
            <Text style={styles.weightUnit}>kg</Text>
          </View>
          <Text style={styles.heroSubtext}>
            Goal: {(userSettings?.goal_type || 'fat_loss').replace('_', ' ')} • target ~0.4 kg / week
          </Text>
        </View>

        {/* Quick Log Weight */}
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
        <Text style={styles.sectionTitle}>📅 History (Past 30 Days)</Text>
        <View style={styles.card}>
          {history?.entries?.length === 0 ? (
            <Text style={styles.emptyText}>No weight entries logged yet.</Text>
          ) : (
            history?.entries?.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{item.logged_date}</Text>
                <Text style={styles.historyVal}>{item.weight_kg} kg</Text>
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
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 13,
    color: '#A79A85',
    marginTop: 8,
    textTransform: 'capitalize',
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C251D',
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
});
