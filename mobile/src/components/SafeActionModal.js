import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, spacing, radius, shadows } from '../theme';

function AlertTriangleIcon({ size = 22, color = '#E57453' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </Svg>
  );
}

/**
 * SafeActionModal
 * Strict two-factor destructive action confirmation modal.
 * 1. Factor 1: Explicit keyword typing ("DELETE" / "RESET"). Confirm button strictly disabled until matched.
 * 2. Factor 2: Mandatory credential challenge / password re-auth.
 * Guaranteed cancellation: If cancelled, all inputs cleared and zero network requests executed.
 */
export default function SafeActionModal({
  visible = false,
  onClose,
  onConfirm,
  title = 'Destructive Action',
  description = 'This action cannot be undone.',
  itemizedWarnings = [],
  requiredKeyword = 'DELETE',
  confirmButtonText = 'Confirm Permanent Deletion',
  requiresPassword = true,
  userEmail = '',
  loading = false,
}) {
  const [typedKeyword, setTypedKeyword] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset inputs whenever modal opens or closes
  useEffect(() => {
    if (visible) {
      setTypedKeyword('');
      setPassword('');
      setLocalError(null);
      setIsSubmitting(false);
    }
  }, [visible]);

  const handleClose = () => {
    setTypedKeyword('');
    setPassword('');
    setLocalError(null);
    setIsSubmitting(false);
    if (onClose) onClose();
  };

  const isKeywordMatched = typedKeyword.trim() === requiredKeyword;
  const isSubmitDisabled = !isKeywordMatched || isSubmitting || loading;

  const handleExecute = async () => {
    if (!isKeywordMatched) {
      setLocalError(`Please type "${requiredKeyword}" in all caps to confirm.`);
      return;
    }

    if (requiresPassword && !password.trim()) {
      setLocalError('Please enter your account password to verify your identity.');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);
    try {
      await onConfirm({
        confirmation: typedKeyword.trim(),
        password: password.trim(),
      });
      // on success, caller handles closing / redirect
    } catch (err) {
      setLocalError(err.message || 'Verification or deletion failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Warning Header */}
            <View style={styles.warningHeaderRow}>
              <View style={styles.iconCircle}>
                <AlertTriangleIcon size={22} color={colors.dangerText || '#E57453'} />
              </View>
              <View style={styles.headerTitleCol}>
                <Text style={styles.titleText}>{title}</Text>
                <Text style={styles.destructiveBadge}>PERMANENT DESTRUCTION</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.descriptionText}>{description}</Text>

            {/* Itemized Warnings */}
            {itemizedWarnings.length > 0 && (
              <View style={styles.warningListBox}>
                <Text style={styles.warningListTitle}>THE FOLLOWING WILL BE PERMANENTLY ERASED:</Text>
                {itemizedWarnings.map((warning, idx) => (
                  <View key={idx} style={styles.warningListItem}>
                    <Text style={styles.warningBullet}>•</Text>
                    <Text style={styles.warningItemText}>{warning}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Error Banner */}
            {localError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{localError}</Text>
              </View>
            )}

            {/* Factor 1: Typing Confirmation */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Type <Text style={styles.keywordHighlight}>{requiredKeyword}</Text> to confirm:
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  isKeywordMatched && styles.textInputMatched,
                ]}
                placeholder={`Type ${requiredKeyword}`}
                placeholderTextColor={colors.textSecondary || '#A79A85'}
                value={typedKeyword}
                onChangeText={(text) => {
                  setTypedKeyword(text);
                  if (localError) setLocalError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={`Type ${requiredKeyword} to confirm deletion`}
              />
            </View>

            {/* Factor 2: Re-Authentication Password */}
            {requiresPassword && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Confirm your password {userEmail ? `(${userEmail})` : ''}:
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Account password"
                  placeholderTextColor={colors.textSecondary || '#A79A85'}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (localError) setLocalError(null);
                  }}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Enter your password to verify authorization"
                />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={isSubmitting || loading}
                accessibilityRole="button"
                accessibilityLabel="Cancel action and keep data safe"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  isSubmitDisabled && styles.confirmBtnDisabled,
                ]}
                onPress={handleExecute}
                disabled={isSubmitDisabled}
                accessibilityRole="button"
                accessibilityLabel={confirmButtonText}
              >
                {isSubmitting || loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text
                    style={[
                      styles.confirmBtnText,
                      isSubmitDisabled && styles.confirmBtnTextDisabled,
                    ]}
                  >
                    {confirmButtonText}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surfaceOverlay || 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md || 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.surface || '#221D17',
    borderRadius: radius.lg || 16,
    borderWidth: 1.5,
    borderColor: colors.danger || '#C7502F',
    padding: spacing.lg || 18,
    ...(shadows.lg || {}),
  },
  scrollContent: {
    paddingBottom: 4,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(199, 80, 47, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  headerTitleCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 2,
  },
  destructiveBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.dangerText || '#E57453',
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 18,
    marginBottom: 12,
  },
  warningListBox: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.sm || 8,
    padding: spacing.sm || 10,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger || '#C7502F',
  },
  warningListTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.dangerText || '#E57453',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  warningListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  warningBullet: {
    fontSize: 12,
    color: colors.dangerText || '#E57453',
    lineHeight: 16,
  },
  warningItemText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary || '#F4ECDD',
    lineHeight: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(199, 80, 47, 0.20)',
    borderRadius: radius.sm || 8,
    padding: spacing.sm || 8,
    borderWidth: 1,
    borderColor: colors.danger || '#C7502F',
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.dangerText || '#E57453',
    fontWeight: '600',
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 6,
  },
  keywordHighlight: {
    fontWeight: '800',
    color: colors.dangerText || '#E57453',
  },
  textInput: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.sm || 8,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    color: colors.textPrimary || '#F4ECDD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textInputMatched: {
    borderColor: colors.danger || '#C7502F',
    backgroundColor: 'rgba(199, 80, 47, 0.10)',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm || 8,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary || '#A79A85',
  },
  confirmBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: radius.sm || 8,
    backgroundColor: colors.danger || '#C7502F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(199, 80, 47, 0.30)',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.40)',
  },
});
