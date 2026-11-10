from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(100), unique=True, index=True, nullable=False)
    razorpay_order_id = Column(String(100), unique=True, index=True, nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(String(50), nullable=False, default="pro_monthly")
    amount_rupees = Column(Integer, nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    status = Column(String(20), nullable=False, default="CREATED")
    coupon_code = Column(String(50), nullable=True)
    discount_amount = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")

    def __repr__(self):
        return f"<PaymentOrder(id={self.id}, order_id={self.order_id}, status={self.status}, amount_rupees={self.amount_rupees})>"
