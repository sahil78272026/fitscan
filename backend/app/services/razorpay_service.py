import time
import uuid
import hmac
import hashlib
import logging
from typing import Optional, Dict, Any

import razorpay
from app.config import get_settings

logger = logging.getLogger("corecontrol.razorpay")


class RazorpayService:
    """Service responsible for Razorpay order generation, signature verification,

    and webhook handling, with automatic mock mode fallback for local testing & development.
    """

    def __init__(self):
        self.settings = get_settings()

    @property
    def is_mock(self) -> bool:
        """Determines if the service operates in mock mode.

        Mock mode is active if:
        1. RAZORPAY_MOCK_MODE is True.
        2. RAZORPAY_KEY_ID is missing or starts with placeholder / mock prefixes.
        Strictly returns False in production environment.
        """
        if getattr(self.settings, "APP_ENV", "") == "production":
            return False
        key_id = (self.settings.RAZORPAY_KEY_ID or "").strip()
        return (
            self.settings.RAZORPAY_MOCK_MODE
            or not key_id
            or key_id.startswith("rzp_test_replace")
            or key_id.startswith("mock_")
        )

    def _get_client(self) -> Optional[razorpay.Client]:
        if self.is_mock:
            return None
        return razorpay.Client(
            auth=(self.settings.RAZORPAY_KEY_ID, self.settings.RAZORPAY_KEY_SECRET)
        )

    def create_order(self, amount_in_rupees: int, receipt_id: str) -> Dict[str, Any]:
        """Creates a payment order in Razorpay (or generates a simulated order in mock mode).

        Amounts are converted from Rupees to Paise (x 100).
        """
        amount_in_paise = amount_in_rupees * 100

        if self.is_mock:
            mock_order_id = f"order_mock_{uuid.uuid4().hex[:14]}"
            logger.info(f"Mock mode active: Created mock Razorpay order {mock_order_id} for Rs. {amount_in_rupees}")
            return {
                "id": mock_order_id,
                "entity": "order",
                "amount": amount_in_paise,
                "amount_paid": 0,
                "amount_due": amount_in_paise,
                "currency": self.settings.RAZORPAY_CURRENCY,
                "receipt": receipt_id,
                "status": "created",
                "attempts": 0,
                "notes": [],
                "created_at": int(time.time()),
            }

        client = self._get_client()
        data = {
            "amount": amount_in_paise,
            "currency": self.settings.RAZORPAY_CURRENCY,
            "receipt": receipt_id,
            "payment_capture": 1,
        }
        return client.order.create(data=data)

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """Verifies the cryptographic HMAC-SHA256 signature returned after checkout."""
        if not signature or not order_id or not payment_id:
            return False

        if self.is_mock:
            # Direct valid test signatures
            if signature in ("mock_signature_valid", "mock_signature"):
                return True

            # Also allow real HMAC-SHA256 computed against test secret
            secret = (self.settings.RAZORPAY_KEY_SECRET or "mock_secret").strip()
            msg = f"{order_id}|{payment_id}"
            expected = hmac.new(
                secret.encode("utf-8"),
                msg.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(expected, signature)

        try:
            client = self._get_client()
            params_dict = {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": signature,
            }
            client.utility.verify_payment_signature(params_dict)
            return True
        except Exception as e:
            logger.warning(f"Razorpay live signature verification failed: {e}")
            return False

    def verify_webhook_signature(
        self,
        body: bytes | str,
        signature: str,
        secret: Optional[str] = None,
    ) -> bool:
        """Verifies the Razorpay webhook X-Razorpay-Signature HMAC-SHA256."""
        if not signature:
            return False

        if self.is_mock:
            if signature in ("mock_signature_valid", "mock_signature"):
                return True

            webhook_secret = (
                secret or self.settings.RAZORPAY_WEBHOOK_SECRET or "mock_webhook_secret"
            ).strip()
            raw_body = body.encode("utf-8") if isinstance(body, str) else body
            expected = hmac.new(
                webhook_secret.encode("utf-8"),
                raw_body,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(expected, signature)

        try:
            client = self._get_client()
            webhook_secret = (secret or self.settings.RAZORPAY_WEBHOOK_SECRET).strip()
            raw_body = body.decode("utf-8") if isinstance(body, bytes) else str(body)
            client.utility.verify_webhook_signature(raw_body, signature, webhook_secret)
            return True
        except Exception as e:
            logger.warning(f"Razorpay webhook signature verification failed: {e}")
            return False

    def fetch_order(self, razorpay_order_id: str) -> Dict[str, Any]:
        """Fetches the order details from Razorpay."""
        if self.is_mock:
            return {
                "id": razorpay_order_id,
                "entity": "order",
                "status": "paid",
                "amount": 99900,
                "currency": self.settings.RAZORPAY_CURRENCY,
            }
        client = self._get_client()
        return client.order.fetch(razorpay_order_id)

    def refund_payment(self, payment_id: str, amount_in_rupees: Optional[int] = None) -> Dict[str, Any]:
        """Initiates a refund for a payment."""
        if self.is_mock:
            return {
                "id": f"rfnd_mock_{uuid.uuid4().hex[:14]}",
                "entity": "refund",
                "payment_id": payment_id,
                "amount": (amount_in_rupees * 100) if amount_in_rupees else None,
                "currency": self.settings.RAZORPAY_CURRENCY,
                "status": "processed",
            }
        client = self._get_client()
        data = {}
        if amount_in_rupees:
            data["amount"] = amount_in_rupees * 100
        return client.payment.refund(payment_id, data)


razorpay_service = RazorpayService()
