from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
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
    start_weight_kg = Column(Float, nullable=True)
    activity_level = Column(String(50), nullable=True, default="moderate")
    workout_time = Column(String(50), nullable=True, default="evening")
    selected_meal_plan = Column(Text, nullable=True)
    subscription_tier = Column(String(20), nullable=True, default="free")
    subscription_status = Column(String(30), nullable=True, default="trial_active")
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    last_plan_change_at = Column(DateTime(timezone=True), nullable=True)
    morning_briefing_enabled = Column(Integer, nullable=True, default=1)  # 1 = true, 0 = false (SQLite/PG compat)
    morning_briefing_start_hour = Column(Integer, nullable=True, default=6)  # 6 AM
    morning_briefing_end_hour = Column(Integer, nullable=True, default=11)  # 11 AM
    morning_briefing_frequency = Column(String(20), nullable=True, default="daily")  # daily, weekdays, weekly
    morning_briefing_cache = Column(Text, nullable=True)  # JSON {date: "YYYY-MM-DD", data: {...}}
    notifications_enabled = Column(Integer, nullable=True, default=1)
    meal_reminders_enabled = Column(Integer, nullable=True, default=1)
    breakfast_reminder_time = Column(String(10), nullable=True, default="09:00")
    lunch_reminder_time = Column(String(10), nullable=True, default="13:30")
    dinner_reminder_time = Column(String(10), nullable=True, default="20:00")
    snack_reminder_time = Column(String(10), nullable=True, default="17:00")
    streak_reminders_enabled = Column(Integer, nullable=True, default=1)
    streak_reminder_time = Column(String(10), nullable=True, default="21:30")
    macro_adherence_reminders_enabled = Column(Integer, nullable=True, default=1)
    timezone = Column(String(50), nullable=True, default="UTC")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="settings")

    def __repr__(self):
        return f"<UserSettings(id={self.id}, user_id={self.user_id}, calorie_goal={self.calorie_goal}, goal_type={self.goal_type})>"

