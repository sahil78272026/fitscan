import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';

export default function ConfirmPlanChangeModal({
  visible,
  onClose,
  onConfirm,
  currentPlan,
}) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>🤖</Text>
              </View>
              <Text style={styles.modalTitle}>Generate New AI Meal Plans?</Text>
              <Text style={styles.modalSubtitle}>
                Powered by Google Gemini Nutrition Engine
              </Text>
            </View>

            {/* Current Active Plan Card */}
            {currentPlan && (
              <View style={styles.currentPlanCard}>
                <Text style={styles.planCardLabel}>CURRENTLY ACTIVE PLAN</Text>
                <Text style={styles.planCardTitle}>{currentPlan.title}</Text>
                <Text style={styles.planCardMacros}>
                  {currentPlan.daily_calories} kcal • {currentPlan.protein_g}g Protein
                </Text>
              </View>
            )}

            {/* AI Nutrition Notice */}
            <View style={styles.warningBoxPro}>
              <View style={styles.warningTitleRow}>
                <Text style={styles.warningIcon}>✨</Text>
                <Text style={styles.warningTitlePro}>Personalized AI Meal Plan</Text>
              </View>
              <Text style={styles.warningDetailPro}>
                Tapping confirm will invoke Google Gemini AI to generate 3 fresh, tailored daily meal plans for your current calorie & macro targets.
              </Text>
              <Text style={[styles.warningDetailPro, { marginTop: 6, color: '#fef08a' }]}>
                ⏱️ Note: To keep your nutrition consistent and optimize AI calls, meal plans can be updated once every 24 hours.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Keep Current Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>Yes, Generate Plans ✨</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#221D17',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#A79A85',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.3)',
  },
  iconText: {
    fontSize: 26,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#A79A85',
    textAlign: 'center',
  },
  currentPlanCard: {
    backgroundColor: '#181410',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  planCardLabel: {
    fontSize: 10,
    color: '#E8A020',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  planCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 2,
  },
  planCardMacros: {
    fontSize: 12,
    color: '#A79A85',
  },
  warningBoxPro: {
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.3)',
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  warningIcon: {
    fontSize: 15,
  },
  warningTitlePro: {
    color: '#E8A020',
    fontSize: 13,
    fontWeight: 'bold',
  },
  warningDetailPro: {
    color: '#D4C8B5',
    fontSize: 12,
    lineHeight: 17,
  },
  warningBoxFree: {
    backgroundColor: 'rgba(234, 88, 12, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.35)',
  },
  warningTitleFree: {
    color: '#FB923C',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  warningDetailFree: {
    color: '#D4C8B5',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  warningDetailFreeAlert: {
    color: '#FDE047',
    fontSize: 11,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'column',
    gap: 8,
  },
  cancelBtn: {
    backgroundColor: '#2C251D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  cancelBtnText: {
    color: '#A79A85',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
