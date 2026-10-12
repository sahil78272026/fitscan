import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function MorningBriefingCard({ briefingData, onDismiss, onLogBreakfast }) {
  if (!briefingData || !briefingData.briefing) return null;

  const { greeting, status_badge, feedback, improvements, focus_today } = briefingData.briefing;

  const getBadgeStyle = (badge) => {
    const b = (badge || '').toLowerCase();
    if (b.includes('target')) return styles.badgeSuccess;
    if (b.includes('protein')) return styles.badgeWarning;
    if (b.includes('surplus')) return styles.badgeAlert;
    return styles.badgeInfo;
  };

  const getBadgeTextStyle = (badge) => {
    const b = (badge || '').toLowerCase();
    if (b.includes('target')) return styles.badgeTextSuccess;
    if (b.includes('protein')) return styles.badgeTextWarning;
    if (b.includes('surplus')) return styles.badgeTextAlert;
    return styles.badgeTextInfo;
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.greetingRow}>
          <View style={styles.sunIconContainer}>
            <Text style={styles.sunIcon}>☀️</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.greetingText}>{greeting || 'Good morning! ☀️'}</Text>
            <Text style={styles.subGreetingText}>Yesterday's Recap & Today's Tips</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {status_badge ? (
            <View style={[styles.badge, getBadgeStyle(status_badge)]}>
              <Text style={[styles.badgeText, getBadgeTextStyle(status_badge)]}>
                {status_badge}
              </Text>
            </View>
          ) : null}

          {onDismiss && (
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.dismissBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Feedback Body */}
      {feedback ? (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      {/* Improvements List */}
      {improvements && improvements.length > 0 ? (
        <View style={styles.improvementsBox}>
          <Text style={styles.improvementsTitle}>💡 Today's Improvements:</Text>
          {improvements.map((tip, idx) => (
            <Text key={idx} style={styles.improvementItem}>
              • {tip}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        {focus_today ? (
          <Text style={styles.focusText}>
            <Text style={styles.focusLabel}>Target Focus: </Text>
            {focus_today}
          </Text>
        ) : <View style={{ flex: 1 }} />}

        {onLogBreakfast && (
          <TouchableOpacity style={styles.actionBtn} onPress={onLogBreakfast}>
            <Text style={styles.actionBtnText}>🍳 Log Breakfast</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#221D17',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sunIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sunIcon: {
    fontSize: 18,
  },
  titleContainer: {
    flex: 1,
  },
  greetingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  subGreetingText: {
    color: '#A79A85',
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(63, 185, 80, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.35)',
  },
  badgeTextSuccess: {
    color: '#3FB950',
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  badgeTextWarning: {
    color: '#FBBF24',
  },
  badgeAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  badgeTextAlert: {
    color: '#F87171',
  },
  badgeInfo: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  badgeTextInfo: {
    color: '#38BDF8',
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: 'bold',
  },
  feedbackContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderLeftWidth: 3,
    borderLeftColor: '#E8A020',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  feedbackText: {
    color: '#E6EDF3',
    fontSize: 13,
    lineHeight: 18,
  },
  improvementsBox: {
    backgroundColor: 'rgba(232, 160, 32, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.22)',
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 10,
    marginBottom: 10,
  },
  improvementsTitle: {
    color: '#E8A020',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  improvementItem: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    gap: 8,
  },
  focusText: {
    flex: 1,
    color: '#A79A85',
    fontSize: 12,
    lineHeight: 16,
  },
  focusLabel: {
    color: '#E8A020',
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: '#E8A020',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#181410',
    fontSize: 12,
    fontWeight: '700',
  },
});
