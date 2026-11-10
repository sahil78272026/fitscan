import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { colors, typography, radius, spacing } from '../../theme';

function EyeIcon({ color = '#94A3B8', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EyeOffIcon({ color = '#94A3B8', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="1"
        y1="1"
        x2="23"
        y2="23"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Universal TextInputField primitive for FitScan mobile.
 * Guarantees minHeight 48dp, WCAG AA contrast, focus states, and error handling.
 *
 * @param {string} [label] - Top field label
 * @param {string} [error] - Error message string (triggers danger border)
 * @param {string} [helperText] - Subtitle helper text (shown when error is absent)
 * @param {React.ReactNode|string} [icon] - Leading icon/emoji
 * @param {React.ReactNode} [rightElement] - Trailing custom element
 * @param {boolean} [secureTextEntry=false] - Password masking with toggle
 * @param {string} [value] - Current text value
 * @param {(text: string) => void} [onChangeText] - Text change handler
 * @param {string} [placeholder] - High contrast placeholder
 * @param {boolean} [disabled=false] - Disables input
 * @param {boolean} [multiline=false] - Multi-line text input
 * @param {number} [numberOfLines=1] - Initial number of lines
 * @param {object} [containerStyle] - Outermost wrapper style
 * @param {object} [inputStyle] - TextInput style override
 * @param {object} [labelStyle] - Label text style override
 * @param {string} [accessibilityLabel] - Spoken label
 */
export function TextInputField({
  label,
  error,
  helperText,
  icon,
  rightElement,
  secureTextEntry = false,
  value,
  onChangeText,
  placeholder,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  containerStyle,
  inputStyle,
  labelStyle,
  accessibilityLabel,
  testID,
  onFocus,
  onBlur,
  ...inputProps
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (typeof onFocus === 'function') {
      onFocus(e);
    }
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (typeof onBlur === 'function') {
      onBlur(e);
    }
  };

  const inputContainerStyles = [
    styles.inputContainer,
    multiline && styles.inputContainerMultiline,
    isFocused && styles.inputContainerFocused,
    Boolean(error) && styles.inputContainerError,
    disabled && styles.inputContainerDisabled,
  ];

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {Boolean(label) ? (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      ) : null}

      <View style={inputContainerStyles}>
        {Boolean(icon) ? (
          <View style={styles.leadingIcon}>
            {typeof icon === 'string' ? (
              <Text style={styles.iconText}>{icon}</Text>
            ) : (
              icon
            )}
          </View>
        ) : null}

        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted || colors.textSecondary || '#94A3B8'}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          accessibilityLabel={accessibilityLabel || (typeof label === 'string' ? label : placeholder)}
          accessibilityRole="none"
          testID={testID}
          {...inputProps}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {secureTextEntry && !rightElement && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            {isPasswordVisible ? (
              <EyeOffIcon color={colors.textSecondary || '#94A3B8'} size={18} />
            ) : (
              <EyeIcon color={colors.textSecondary || '#94A3B8'} size={18} />
            )}
          </TouchableOpacity>
        )}

        {rightElement && (
          <View style={styles.trailingElement}>
            {rightElement}
          </View>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md || 12,
  },
  label: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '600',
    color: colors.textSecondary || '#94A3B8',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    borderRadius: radius.md || 10,
    minHeight: 48, // Standard 48dp touch target
    paddingHorizontal: 12,
  },
  inputContainerMultiline: {
    minHeight: 88,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  inputContainerFocused: {
    borderColor: colors.borderFocus || colors.primary || '#F59E0B',
  },
  inputContainerError: {
    borderColor: colors.danger || '#EF4444',
  },
  inputContainerDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    color: colors.textPrimary || '#F8FAFC',
    fontSize: typography?.sizes?.base || 15,
    paddingVertical: 10,
  },
  inputMultiline: {
    textAlignVertical: 'top',
  },
  leadingIcon: {
    marginRight: 8,
  },
  iconText: {
    fontSize: 16,
  },
  trailingElement: {
    marginLeft: 8,
  },
  eyeBtn: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    fontSize: typography?.sizes?.xs || 12,
    color: colors.dangerText || colors.danger || '#EF4444',
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 4,
    marginLeft: 2,
  },
});

export default TextInputField;
