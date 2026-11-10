import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function RazorpayCheckoutModal({
  visible,
  orderData,
  onSuccess,
  onFailure,
  onDismiss,
}) {
  if (!visible || !orderData) return null;

  const rzpKeyId =
    orderData.key_id ||
    process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
    'rzp_test_replace_with_your_key_id';

  const checkoutHtml = useMemo(() => {
    const rzpOptions = {
      key: rzpKeyId,
      amount: orderData.amount, // in paise
      currency: orderData.currency || 'INR',
      name: 'FitScan CoreControl',
      description: orderData.description || 'CoreControl Pro Membership',
      order_id: orderData.razorpay_order_id || orderData.id || orderData.order_id,
      prefill: {
        name: orderData.prefill?.name || '',
        email: orderData.prefill?.email || '',
        contact: orderData.prefill?.contact || '',
      },
      theme: {
        color: '#E8A020',
        backdrop_color: 'rgba(24, 20, 16, 0.9)',
      },
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <title>FitScan Checkout</title>
          <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
          <style>
            * { box-sizing: border-box; }
            body {
              background-color: #181410;
              color: #F4ECDD;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 24px;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 3px solid #2C251D;
              border-top: 3px solid #E8A020;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .title {
              font-size: 16px;
              font-weight: 600;
              color: #F4ECDD;
              margin-bottom: 6px;
            }
            .subtitle {
              font-size: 13px;
              color: #A79A85;
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <div class="title">Securing Payment Channel</div>
          <div class="subtitle">Connecting with Razorpay...</div>
          <script>
            function sendBridgeMessage(payload) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
              }
            }

            window.addEventListener('load', function() {
              try {
                var options = ${JSON.stringify(rzpOptions)};

                options.handler = function(response) {
                  sendBridgeMessage({
                    type: 'SUCCESS',
                    response: {
                      razorpay_order_id: response.razorpay_order_id || options.order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }
                  });
                };

                options.modal = {
                  ondismiss: function() {
                    sendBridgeMessage({ type: 'DISMISSED' });
                  },
                  backdropclose: false,
                  escape: true
                };

                var rzp = new Razorpay(options);

                rzp.on('payment.failed', function(resp) {
                  sendBridgeMessage({
                    type: 'FAILED',
                    error: resp.error || { description: 'Payment failed' }
                  });
                });

                rzp.open();
              } catch (err) {
                sendBridgeMessage({
                  type: 'FAILED',
                  error: { description: err.message || 'Failed to initialize payment gateway' }
                });
              }
            });
          </script>
        </body>
      </html>
    `;
  }, [orderData, rzpKeyId]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SUCCESS') {
        if (onSuccess) onSuccess(data.response);
      } else if (data.type === 'DISMISSED') {
        if (onDismiss) onDismiss();
      } else if (data.type === 'FAILED') {
        if (onFailure) onFailure(data.error);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('Checkout bridge parse error:', err);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Secure Razorpay Checkout</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close Checkout"
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* In-App WebView */}
        <View style={styles.webViewWrapper}>
          <WebView
            originWhitelist={['*']}
            source={{ html: checkoutHtml, baseUrl: 'https://checkout.razorpay.com' }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#E8A020" />
                <Text style={styles.loadingText}>Initializing Payment...</Text>
              </View>
            )}
            style={styles.webView}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
  },
  headerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#221D17',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4ECDD',
    letterSpacing: 0.2,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#2C251D',
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A79A85',
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: '#181410',
  },
  webView: {
    flex: 1,
    backgroundColor: '#181410',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#181410',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#A79A85',
    fontSize: 13,
  },
});
