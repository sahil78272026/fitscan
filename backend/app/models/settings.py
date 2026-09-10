from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    calorie_goal = Column(Integer, nullable=False, default=2000)
    protein_goal = Column(Integer, nullable=False, default=150)
    carbs_goal = Column(Integer, nullable=False, default=200)
    fat_goal = Column(Integer, nullable=False, default=65)
    goal_type = Column(String(50), nullable=True, default="fat_loss")
    diet_type = Column(String(50), nullable=True, default="veg")
    budget_tier = Column(String(50), nullable=True, default="moderate")
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    activity_level = Column(String(50), nullable=True, default="moderate")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="settings")

    def __repr__(self):
        return f"<UserSettings(id={self.id}, user_id={self.user_id}, calorie_goal={self.calorie_goal}, goal_type={self.goal_type})>"

