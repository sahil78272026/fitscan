from sqlalchemy import Column, Integer, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class StepLog(Base):
    __tablename__ = "step_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    step_count = Column(Integer, nullable=False, default=0)
    calories_burned = Column(Float, nullable=False, default=0.0)
    logged_date = Column(Date, nullable=False, default=func.current_date())
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="step_logs")

    __table_args__ = (
        UniqueConstraint("user_id", "logged_date", name="uix_user_step_logged_date"),
    )

    def __repr__(self):
        return f"<StepLog(id={self.id}, user_id={self.user_id}, step_count={self.step_count}, date={self.logged_date})>"
