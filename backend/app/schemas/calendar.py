from pydantic import BaseModel
from datetime import date


class CalendarDayResponse(BaseModel):
    date: date
    total_calories: int
    meal_count: int


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarDayResponse]
