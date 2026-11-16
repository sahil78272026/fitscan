from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    push_token = Column(String(255), unique=True, nullable=False, index=True)
    platform = Column(String(50), default="android", nullable=False)
    device_name = Column(String(100), nullable=True)
    is_active = Column(Integer, default=1, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="devices")

    def __repr__(self):
        return f"<UserDevice(id={self.id}, user_id={self.user_id}, platform={self.platform}, is_active={self.is_active})>"
