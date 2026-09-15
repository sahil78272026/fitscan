import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { updateUserGoals } from '../services/api';

export default function OnboardingModal({ visible, initialSettings, onClose, onComplete }) {
  const [goalType, setGoalType] = useState(initialSettings?.goal_type || 'fat_loss');
  const [dietType, setDietType] = useState(initialSettings?.diet_type || 'veg');
  const [budgetTier, setBudgetTier] = useState(initialSettings?.budget_tier || 'moderate');
  const [activityLevel, setActivityLevel] = useState(initialSettings?.activity_level || 'moderate');
  const [age, setAge] = useState(initialSettings?.age ? String(initialSettings.age) : '25');
  const [gender, setGender] = useState(initialSettings?.gender || 'male');
  const [heightCm, setHeightCm] = useState(initialSettings?.height_cm ? String(initialSettings.height_cm) : '175');
  const [weightKg, setWeightKg] = useState(initialSettings?.weight_kg ? String(initialSettings.weight_kg) : '70');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        goal_type: goalType,
        diet_type: dietType,
        budget_tier: budgetTier,
        activity_level: activityLevel,
        age: parseInt(age, 10) || 25,
        gender,
        height_cm: parseFloat(heightCm) || 175,
        weight_kg: parseFloat(weightKg) || 70,
      };

      const updated = await updateUserGoals(payload);
      onComplete(updated);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save onboarding goals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.headerTitle}>⚙️ Onboarding & Goal Wizard</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Goal Type */}
          <Text style={styles.label}>Primary Fitness Goal</Text>
          <View style={styles.optionGrid}>
            {[
              { id: 'fat_loss', label: '🔥 Fat Loss' },
              { id: 'muscle_gain', label: '💪 Muscle Gain' },
              { id: 'maintenance', label: '⚖️ Maintenance' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionCard, goalType === item.id && styles.optionCardActive]}
                onPress={() => setGoalType(item.id)}
              >
                <Text style={[styles.optionText, goalType === item.id && styles.optionTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Diet Type */}
          <Text style={styles.label}>Dietary Preference</Text>
          <View style={styles.optionGrid}>
            {[
              { id: 'veg', label: '🥦 Vegetarian' },
              { id: 'non_veg', label: '🍗 Non-Veg' },
              { id: 'eggetarian', label: '🍳 Eggetarian' },
              { id: 'vegan', label: '🌱 Vegan' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionCard, dietType === item.id && styles.optionCardActive]}
                onPress={() => setDietType(item.id)}
              >
                <Text style={[styles.optionText, dietType === item.id && styles.optionTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget Tier */}
          <Text style={styles.label}>Budget Tier</Text>
          <View style={styles.optionGrid}>
            {[
              { id: 'budget', label: '💵 Budget Friendly' },
              { id: 'moderate', label: '💳 Moderate' },
              { id: 'premium', label: '💎 Premium / Organic' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionCard, budgetTier === item.id && styles.optionCardActive]}
                onPress={() => setBudgetTier(item.id)}
              >
                <Text style={[styles.optionText, budgetTier === item.id && styles.optionTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Physical Metrics */}
          <Text style={styles.label}>Body Metrics</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputBox}>
              <Text style={styles.subLabel}>Age</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
              />
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.subLabel}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={heightCm}
                onChangeText={setHeightCm}
              />
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.subLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={weightKg}
                onChangeText={setWeightKg}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Goals & Calculate Plan</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingTop: 44,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f0f6fc',
  },
  closeText: {
    color: '#8b949e',
    fontSize: 14,
  },
  scroll: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#58a6ff',
    marginTop: 14,
    marginBottom: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionCardActive: {
    backgroundColor: '#1f6feb',
    borderColor: '#388bfd',
  },
  optionText: {
    color: '#c9d1d9',
    fontSize: 13,
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputBox: {
    flex: 1,
  },
  subLabel: {
    fontSize: 11,
    color: '#8b949e',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    color: '#f0f6fc',
    padding: 10,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#238636',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
