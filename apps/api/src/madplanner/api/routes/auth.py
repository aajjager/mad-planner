from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from madplanner.core.config import get_settings
from madplanner.db.session import get_session
from madplanner.models import FamilyRole
from madplanner.schemas.account import (
    AccountResponse,
    FamilyMemberResponse,
    FamilySettingsResponse,
    FamilySettingsUpdate,
    InvitationAcceptRequest,
    InvitationCreateRequest,
    InvitationPreviewResponse,
    InvitationResponse,
    LoginRequest,
    ManagedInvitationResponse,
    OwnerSetupRequest,
    SetupStatusResponse,
)
from madplanner.services.auth import AuthContext, AuthService

router = APIRouter(prefix="/auth", tags=["authentication"])


def get_auth_service(session: Annotated[Session, Depends(get_session)]) -> AuthService:
    return AuthService(session)


def session_token(request: Request) -> str | None:
    return request.cookies.get(get_settings().session_cookie_name)


def require_auth(
    token: Annotated[str | None, Depends(session_token)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthContext:
    context = service.authenticate(token)
    if context is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return context


def account_response(context: AuthContext) -> AccountResponse:
    return AccountResponse(
        id=context.user.id,
        email=context.user.email,
        display_name=context.user.display_name,
        family_id=context.family.id,
        family_name=context.family.name,
        role=context.role,
    )


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(service: Annotated[AuthService, Depends(get_auth_service)]):
    return SetupStatusResponse(setup_required=service.setup_required())


@router.post("/setup", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def setup_owner(data: OwnerSetupRequest, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        context, token = service.create_owner(**data.model_dump())
    except ValueError:
        raise HTTPException(status_code=409, detail="Initial setup is already complete") from None
    set_session_cookie(response, token)
    return account_response(context)


@router.post("/login", response_model=AccountResponse)
def login(data: LoginRequest, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    result = service.login(data.email, data.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    context, token = result
    set_session_cookie(response, token)
    return account_response(context)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, token: Annotated[str | None, Depends(session_token)], service: Annotated[AuthService, Depends(get_auth_service)]):
    service.logout(token)
    response.delete_cookie(get_settings().session_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/me", response_model=AccountResponse)
def current_account(context: Annotated[AuthContext, Depends(require_auth)]):
    return account_response(context)


@router.get("/family/members", response_model=list[FamilyMemberResponse])
def family_members(context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    return [
        FamilyMemberResponse(id=item.user.id, email=item.user.email, display_name=item.user.display_name, role=item.role, active_sessions=service.count_sessions(item.user.id, context.family.id))
        for item in service.list_members(context.family.id)
    ]


def require_owner(context: Annotated[AuthContext, Depends(require_auth)]) -> AuthContext:
    if context.role is not FamilyRole.OWNER:
        raise HTTPException(status_code=403, detail="Only a family owner can manage logins")
    return context


def family_settings_response(context: AuthContext) -> FamilySettingsResponse:
    return FamilySettingsResponse(
        household_size=context.family.household_size,
        leftovers_enabled=context.family.leftovers_enabled,
        cooking_mode_enabled=context.family.cooking_mode_enabled,
        enabled_meal_types=context.family.enabled_meal_types,
    )


@router.get("/family/settings", response_model=FamilySettingsResponse)
def family_settings(context: Annotated[AuthContext, Depends(require_auth)]):
    return family_settings_response(context)


@router.put("/family/settings", response_model=FamilySettingsResponse)
def update_family_settings(data: FamilySettingsUpdate, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    service.update_family_settings(context.family, **data.model_dump())
    return family_settings_response(context)


@router.get("/admin/invitations", response_model=list[ManagedInvitationResponse])
def managed_invitations(context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    return [
        ManagedInvitationResponse(id=item.id, intended_email=item.intended_email or "", expires_at=item.expires_at.isoformat())
        for item in service.list_pending_invitations(context.family.id)
    ]


@router.delete("/admin/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(invitation_id: int, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]) -> Response:
    if not service.revoke_invitation(context.family.id, invitation_id):
        raise HTTPException(status_code=404, detail="Invitation not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/admin/members/{user_id}/revoke-sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_member_sessions(user_id: int, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]) -> Response:
    if not service.revoke_member_sessions(context.family.id, user_id):
        raise HTTPException(status_code=404, detail="Family member not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/admin/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(user_id: int, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]) -> Response:
    if not service.remove_member(context.family.id, user_id):
        raise HTTPException(status_code=404, detail="Family member not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/family/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(data: InvitationCreateRequest, context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    if context.role is not FamilyRole.OWNER:
        raise HTTPException(status_code=403, detail="Only a family owner can invite members")
    try:
        invitation, token = service.create_invitation(context, data.email)
    except ValueError:
        raise HTTPException(status_code=409, detail="An account already exists for this email") from None
    return InvitationResponse(
        token=token,
        family_name=context.family.name,
        intended_email=invitation.intended_email or "",
        expires_at=invitation.expires_at.isoformat(),
    )


@router.get("/invitations/{token}", response_model=InvitationPreviewResponse)
def invitation_preview(token: str, service: Annotated[AuthService, Depends(get_auth_service)]):
    invitation = service.get_invitation(token)
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation is invalid or expired")
    return InvitationPreviewResponse(
        family_name=invitation.family.name,
        intended_email=invitation.intended_email or "",
        expires_at=invitation.expires_at.isoformat(),
    )


@router.post("/invitations/{token}/accept", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def accept_invitation(token: str, data: InvitationAcceptRequest, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        result = service.accept_invitation(token, data.display_name, data.password)
    except ValueError:
        raise HTTPException(status_code=409, detail="An account already exists for this email") from None
    if result is None:
        raise HTTPException(status_code=404, detail="Invitation is invalid or expired")
    context, session_value = result
    set_session_cookie(response, session_value)
    return account_response(context)
