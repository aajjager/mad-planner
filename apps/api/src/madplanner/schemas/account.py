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


class InvitationCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InvitationResponse(BaseModel):
    token: str
    family_name: str
    intended_email: str
    expires_at: str


class InvitationPreviewResponse(BaseModel):
    family_name: str
    intended_email: str
    expires_at: str


class InvitationAcceptRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)
