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


class MfaChallengeResponse(BaseModel):
    mfa_required: Literal[True] = True
    challenge_token: str


class MfaLoginRequest(BaseModel):
    challenge_token: str = Field(min_length=20, max_length=200)
    code: str = Field(min_length=6, max_length=30)


class AccountResponse(BaseModel):
    id: int
    email: str
    display_name: str
    family_id: int
    family_name: str
    role: FamilyRole
    locale: Literal["en", "da", "nl"]
    show_nutrition: bool
    dark_mode: bool
    accent_theme: Literal["sage", "ocean", "berry", "gold"]
    browser_notifications_enabled: bool
    mfa_enabled: bool


class PersonalPreferencesUpdate(BaseModel):
    locale: Literal["en", "da", "nl"] | None = None
    show_nutrition: bool | None = None
    dark_mode: bool | None = None
    accent_theme: Literal["sage", "ocean", "berry", "gold"] | None = None
    browser_notifications_enabled: bool | None = None


class MfaEnrollmentResponse(BaseModel):
    secret: str
    provisioning_uri: str


class MfaConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class MfaRecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]


class MfaDisableRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class PasswordResetLinkResponse(BaseModel):
    token: str
    intended_email: str
    expires_at: str


class PasswordResetPreviewResponse(BaseModel):
    intended_email: str


class PasswordResetRequest(BaseModel):
    password: str = Field(min_length=10, max_length=200)


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


class SecurityEventResponse(BaseModel):
    id: int
    event_type: str
    user_email: str | None
    created_at: str


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
    plan_reminders_enabled: bool
    plan_reminder_weeks: int
    planning_suggestion_mode: Literal["review", "auto"]
    rating_filter_enabled: bool
    rating_minimum: int
    rating_target_percent: int
    rated_recipe_count: int
    rating_filter_eligible: bool
    enabled_meal_types: list[Literal["breakfast", "lunch", "dinner"]]


class FamilySettingsUpdate(BaseModel):
    household_size: int = Field(ge=1, le=50)
    leftovers_enabled: bool
    cooking_mode_enabled: bool
    plan_reminders_enabled: bool
    plan_reminder_weeks: int = Field(ge=1, le=4)
    planning_suggestion_mode: Literal["review", "auto"] = "review"
    rating_filter_enabled: bool = False
    rating_minimum: int = Field(default=3, ge=1, le=5)
    rating_target_percent: int = Field(default=50, ge=0, le=100)
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
