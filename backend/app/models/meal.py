from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_type = Column(String(20), nullable=False)  # breakfast, lunch, dinner, snack
    raw_input = Column(String(500), nullable=False)  # user's original text
    total_calories = Column(Integer, nullable=False, default=0)
    total_protein = Column(Float, nullable=False, default=0.0)
    total_carbs = Column(Float, nullable=False, default=0.0)
    total_fat = Column(Float, nullable=False, default=0.0)
    image_url = Column(String(500), nullable=True)
    meal_date = Column(Date, nullable=False, index=True)  # for daily grouping
    logged_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="meals")
    food_items = relationship("FoodItem", back_populates="meal", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Meal(id={self.id}, type={self.meal_type}, calories={self.total_calories}, protein={self.total_protein}g)>"


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_id = Column(Integer, ForeignKey("meals.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(50), nullable=False, default="serving")
    calories = Column(Integer, nullable=False, default=0)
    protein = Column(Float, nullable=False, default=0.0)
    carbs = Column(Float, nullable=False, default=0.0)
    fat = Column(Float, nullable=False, default=0.0)

    meal = relationship("Meal", back_populates="food_items")

    def __repr__(self):
        return f"<FoodItem(id={self.id}, name={self.name}, calories={self.calories}, protein={self.protein}g)>"
