/**
 * Firebase Phone Auth Bridge for React Native.
 *
 * Runs the full Firebase signInWithPhoneNumber flow inside a hidden WebView
 * (where RecaptchaVerifier works natively), and communicates results back
 * to React Native via postMessage.
 *
 * Usage:
 *   <FirebasePhoneAuthBridge ref={bridgeRef} firebaseConfig={config} />
 *
 *   // Send OTP:
 *   const result = await bridgeRef.current.sendOtp('+919876543210');
 *
 *   // Verify OTP:
 *   const { idToken } = await bridgeRef.current.verifyOtp('123456');
 */
import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

function buildHTML(firebaseConfig) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: transparent; margin: 0; }
    #recaptcha-container { }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script>
    // Initialize Firebase
    var config = ${JSON.stringify(firebaseConfig)};
    firebase.initializeApp(config);
    var auth = firebase.auth();
    auth.languageCode = 'en';

    var confirmationResult = null;

    function sendToRN(type, data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data }));
    }

    // Setup invisible reCAPTCHA once
    var recaptchaVerifier = null;
    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: function(token) {
          // reCAPTCHA solved — signInWithPhoneNumber will proceed
        },
        'expired-callback': function() {
          sendToRN('error', 'reCAPTCHA expired. Please try again.');
        }
      });
      sendToRN('ready', 'Bridge initialized');
    } catch(err) {
      sendToRN('error', 'reCAPTCHA init failed: ' + err.message);
    }

    // Called from React Native to send OTP
    window.sendOtp = function(phoneNumber) {
      if (!recaptchaVerifier) {
        sendToRN('otp-error', 'reCAPTCHA not ready');
        return;
      }
      auth.signInWithPhoneNumber(phoneNumber, recaptchaVerifier)
        .then(function(result) {
          confirmationResult = result;
          sendToRN('otp-sent', 'OTP sent successfully');
        })
        .catch(function(err) {
          sendToRN('otp-error', err.message || 'Failed to send OTP');
          // Reset reCAPTCHA for retry
          try {
            recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
              size: 'invisible',
              callback: function() {},
              'expired-callback': function() {
                sendToRN('error', 'reCAPTCHA expired');
              }
            });
          } catch(e) {}
        });
    };

    // Called from React Native to verify OTP
    window.verifyOtp = function(code) {
      if (!confirmationResult) {
        sendToRN('verify-error', 'No confirmation result. Send OTP first.');
        return;
      }
      confirmationResult.confirm(code)
        .then(function(userCredential) {
          return userCredential.user.getIdToken();
        })
        .then(function(idToken) {
          sendToRN('verify-success', idToken);
        })
        .catch(function(err) {
          sendToRN('verify-error', err.message || 'Invalid OTP');
        });
    };
  </script>
</body>
</html>`;
}


const FirebasePhoneAuthBridge = forwardRef(function FirebasePhoneAuthBridge(
  { firebaseConfig },
  ref
) {
  const webViewRef = useRef(null);
  const pendingCallbacks = useRef({});
  const isReady = useRef(false);

  useImperativeHandle(ref, () => ({
    sendOtp: (phoneNumber) => {
      return new Promise((resolve, reject) => {
        pendingCallbacks.current['otp'] = { resolve, reject };
        // Use JSON.stringify to safely escape the phone number (especially the + sign)
        const safePhone = JSON.stringify(phoneNumber);
        const js = `window.sendOtp(${safePhone}); true;`;
        webViewRef.current?.injectJavaScript(js);
      });
    },
    verifyOtp: (code) => {
      return new Promise((resolve, reject) => {
        pendingCallbacks.current['verify'] = { resolve, reject };
        const safeCode = JSON.stringify(code);
        const js = `window.verifyOtp(${safeCode}); true;`;
        webViewRef.current?.injectJavaScript(js);
      });
    },
    isReady: () => isReady.current,
  }));

  const handleMessage = useCallback((event) => {
    try {
      const { type, data } = JSON.parse(event.nativeEvent.data);

      switch (type) {
        case 'ready':
          isReady.current = true;
          break;

        case 'otp-sent':
          pendingCallbacks.current['otp']?.resolve({ success: true, message: data });
          delete pendingCallbacks.current['otp'];
          break;

        case 'otp-error':
          pendingCallbacks.current['otp']?.reject(new Error(data));
          delete pendingCallbacks.current['otp'];
          break;

        case 'verify-success':
          pendingCallbacks.current['verify']?.resolve({ idToken: data });
          delete pendingCallbacks.current['verify'];
          break;

        case 'verify-error':
          pendingCallbacks.current['verify']?.reject(new Error(data));
          delete pendingCallbacks.current['verify'];
          break;

        case 'error':
          console.warn('[FirebasePhoneAuthBridge]', data);
          break;

        case 'debug':
          console.log('[FirebasePhoneAuthBridge:WebView]', data);
          break;
      }
    } catch (err) {
      console.error('[FirebasePhoneAuthBridge] message parse error:', err);
    }
  }, []);

  const html = buildHTML(firebaseConfig);
  const baseUrl = `https://${firebaseConfig.authDomain}`;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        originWhitelist={['*']}
        onError={(syntheticEvent) => {
          console.warn('[FirebasePhoneAuthBridge] WebView error:', syntheticEvent.nativeEvent);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  webview: {
    width: 1,
    height: 1,
  },
});

export { FirebasePhoneAuthBridge };
