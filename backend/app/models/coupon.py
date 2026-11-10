from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    discount_percentage = Column(Integer, nullable=False, default=100)
    duration_days = Column(Integer, nullable=False, default=365)
    max_uses = Column(Integer, nullable=True)
    times_used = Column(Integer, nullable=False, default=0)
    valid_from = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    redemptions = relationship("CouponRedemption", back_populates="coupon", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Coupon(id={self.id}, code='{self.code}', discount={self.discount_percentage}%, active={self.is_active})>"


class CouponRedemption(Base):
    __tablename__ = "coupon_redemptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    discount_applied = Column(Integer, nullable=False)
    redeemed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    coupon = relationship("Coupon", back_populates="redemptions")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("coupon_id", "user_id", name="uq_coupon_user_redemption"),
    )

    def __repr__(self):
        return f"<CouponRedemption(id={self.id}, coupon_id={self.coupon_id}, user_id={self.user_id}, discount={self.discount_applied}%)>"
