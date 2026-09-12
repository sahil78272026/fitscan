from sqlalchemy import Column, Integer, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class WeightLog(Base):
    __tablename__ = "weight_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    weight_kg = Column(Float, nullable=False)
    logged_date = Column(Date, nullable=False, default=func.current_date())
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="weight_logs")

    __table_args__ = (
        UniqueConstraint("user_id", "logged_date", name="uix_user_weight_logged_date"),
    )

    def __repr__(self):
        return f"<WeightLog(id={self.id}, user_id={self.user_id}, weight_kg={self.weight_kg}, date={self.logged_date})>"
