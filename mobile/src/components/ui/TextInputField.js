import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, radius, spacing } from '../../theme';

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
          placeholderTextColor={colors.textSecondary || '#A79A85'}
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
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.eyeIcon}>{isPasswordVisible ? '👁️' : '🔒'}</Text>
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
    color: colors.textSecondary || '#A79A85',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
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
    borderColor: colors.primary || '#E8A020',
  },
  inputContainerError: {
    borderColor: colors.danger || '#C7502F',
  },
  inputContainerDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    color: colors.textPrimary || '#F4ECDD',
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
    color: colors.dangerText || '#E57453',
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginTop: 4,
    marginLeft: 2,
  },
});

export default TextInputField;
