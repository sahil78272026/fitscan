/**
 * Dynamic script loader for Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js).
 * Safe for Next.js SSR hydration and ensures idempotency.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      return resolve(false);
    }
    if (window.Razorpay) {
      return resolve(true);
    }
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
