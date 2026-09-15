import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { logMeal, scanMealImage, scanMealImageBase64 } from '../services/api';

export default function ScanMealScreen({ navigation, route }) {
  const [imageUri, setImageUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [rawInput, setRawInput] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [loading, setLoading] = useState(false);

  const mealDate = route?.params?.mealDate || null;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll access is needed to upload meal photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (asset.base64) {
        setPhotoBase64(asset.base64);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is needed to take meal photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (asset.base64) {
        setPhotoBase64(asset.base64);
      }
    }
  };

  const handleLogMeal = async () => {
    if (!rawInput.trim() && !imageUri && !photoBase64) {
      if (Platform.OS === 'web') {
        alert('Please describe your meal or select an image.');
      } else {
        Alert.alert('Empty Input', 'Please describe your meal or select an image.');
      }
      return;
    }

    setLoading(true);
    try {
      if (photoBase64) {
        await scanMealImageBase64(photoBase64, rawInput.trim(), mealType, mealDate);
      } else if (imageUri) {
        await scanMealImage(imageUri, rawInput.trim(), mealType, mealDate);
      } else {
        await logMeal(rawInput.trim(), mealType, mealDate);
      }

      if (Platform.OS === 'web') {
        alert('Meal Logged! 🎉 AI calorie analysis completed.');
      } else {
        Alert.alert('Meal Logged! 🎉', 'AI calorie analysis completed.');
      }
      navigation.goBack();
    } catch (err) {
      if (Platform.OS === 'web') {
        alert('Error: ' + (err.message || 'Failed to log meal'));
      } else {
        Alert.alert('Error', err.message || 'Failed to log meal');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>📸 Log & Scan Meal</Text>

        {/* Image Preview Box */}
        <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>📷</Text>
              <Text style={styles.placeholderText}>Tap to select or take photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Buttons for Camera / Gallery */}
        <View style={styles.mediaRow}>
          <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto}>
            <Text style={styles.mediaBtnText}>📷 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
            <Text style={styles.mediaBtnText}>🖼️ Choose Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Text Input for meal description */}
        <Text style={styles.label}>Meal Description (Optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. 2 eggs, 1 slice toast with butter"
          placeholderTextColor="#6e7681"
          value={rawInput}
          onChangeText={setRawInput}
        />

        {/* Meal Type selector */}
        <Text style={styles.label}>Meal Type</Text>
        <View style={styles.typeRow}>
          {['breakfast', 'lunch', 'snack', 'dinner'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, mealType === type && styles.typeBtnActive]}
              onPress={() => setMealType(type)}
            >
              <Text style={[styles.typeText, mealType === type && styles.typeTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleLogMeal} disabled={loading}>
          {loading ? <ActivityIndicator color="#221803" /> : <Text style={styles.submitText}>Analyze & Log Meal</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
  },
  inner: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 20,
  },
  imageBox: {
    height: 200,
    backgroundColor: '#221D17',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3A3128',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#A79A85',
    fontSize: 14,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  mediaBtn: {
    flex: 1,
    backgroundColor: '#2C251D',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  mediaBtnText: {
    color: '#E8A020',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F4ECDD',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2C251D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    fontSize: 15,
    padding: 12,
    marginBottom: 20,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#2C251D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  typeText: {
    color: '#A79A85',
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#221803',
  },
  submitBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  submitText: {
    color: '#221803',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
