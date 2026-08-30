from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


UserRole = Literal["admin", "collaborator"]


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=60)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = "collaborator"


class UserUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=120,
    )
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=60,
    )
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


class AdminPasswordReset(BaseModel):
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


class UserRead(UserBase):
    id: int
    role: str
    is_active: bool
    has_photo: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    message: str