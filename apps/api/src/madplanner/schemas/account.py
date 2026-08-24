from typing import Literal

from pydantic import BaseModel, Field

from madplanner.models.account import FamilyRole


class SetupStatusResponse(BaseModel):
    setup_required: bool


class OwnerSetupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)
    family_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class AccountResponse(BaseModel):
    id: int
    email: str
    display_name: str
    family_id: int
    family_name: str
    role: FamilyRole
    locale: Literal["en", "da", "nl"]


class PersonalPreferencesUpdate(BaseModel):
    locale: Literal["en", "da", "nl"]


class FamilyMemberResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: FamilyRole
    active_sessions: int = 0


class ManagedInvitationResponse(BaseModel):
    id: int
    intended_email: str
    expires_at: str
    role: FamilyRole


class FamilyMemberRoleUpdate(BaseModel):
    role: Literal["editor", "planner", "viewer"]


class RecipeTypeResponse(BaseModel):
    id: int
    name: str
    meal_type: Literal["breakfast", "lunch", "dinner"] | None


class RecipeTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    meal_type: Literal["breakfast", "lunch", "dinner"] | None = None


class FamilySettingsResponse(BaseModel):
    household_size: int
    leftovers_enabled: bool
    cooking_mode_enabled: bool
    enabled_meal_types: list[Literal["breakfast", "lunch", "dinner"]]


class FamilySettingsUpdate(BaseModel):
    household_size: int = Field(ge=1, le=50)
    leftovers_enabled: bool
    cooking_mode_enabled: bool
    enabled_meal_types: list[Literal["breakfast", "lunch", "dinner"]] = Field(min_length=1)


class InvitationCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["editor", "planner", "viewer"] = "editor"


class InvitationResponse(BaseModel):
    token: str
    family_name: str
    intended_email: str
    expires_at: str
    role: FamilyRole


class InvitationPreviewResponse(BaseModel):
    family_name: str
    intended_email: str
    expires_at: str
    role: FamilyRole


class InvitationAcceptRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)
