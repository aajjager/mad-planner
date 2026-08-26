from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from madplanner.core.config import get_settings
from madplanner.db.session import get_session
from madplanner.models import FamilyRole
from madplanner.schemas.account import (
    AccountResponse,
    FamilyMemberResponse,
    FamilyMemberRoleUpdate,
    FamilySettingsResponse,
    FamilySettingsUpdate,
    InvitationAcceptRequest,
    InvitationCreateRequest,
    InvitationPreviewResponse,
    InvitationResponse,
    LoginRequest,
    MfaChallengeResponse,
    MfaLoginRequest,
    MfaConfirmRequest,
    MfaEnrollmentResponse,
    MfaDisableRequest,
    MfaRecoveryCodesResponse,
    ManagedInvitationResponse,
    OwnerSetupRequest,
    PasswordResetLinkResponse,
    PasswordResetPreviewResponse,
    PasswordResetRequest,
    PersonalPreferencesUpdate,
    RecipeTypeCreate,
    RecipeTypeResponse,
    SecurityEventResponse,
    SetupStatusResponse,
)
from madplanner.services.auth import AuthContext, AuthService, MfaChallenge

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
        locale=context.user.locale,
        show_nutrition=context.user.show_nutrition,
        browser_notifications_enabled=context.user.browser_notifications_enabled,
        mfa_enabled=context.user.mfa_enabled,
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


@router.post("/login", response_model=AccountResponse | MfaChallengeResponse)
def login(data: LoginRequest, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    result = service.login(data.email, data.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if isinstance(result, MfaChallenge):
        return MfaChallengeResponse(challenge_token=result.token)
    context, token = result
    set_session_cookie(response, token)
    return account_response(context)


@router.post("/login/mfa", response_model=AccountResponse)
def login_mfa(data: MfaLoginRequest, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    key = get_settings().mfa_encryption_key
    if key is None or not key.get_secret_value():
        raise HTTPException(status_code=503, detail="MFA encryption is not configured")
    result = service.complete_mfa_login(data.challenge_token, data.code, key.get_secret_value())
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication code")
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


@router.patch("/me/preferences", response_model=AccountResponse)
def update_personal_preferences(data: PersonalPreferencesUpdate, context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    service.update_personal_preferences(
        context.user,
        locale=data.locale,
        show_nutrition=data.show_nutrition,
        browser_notifications_enabled=data.browser_notifications_enabled,
    )
    return account_response(context)


@router.post("/me/mfa/enroll", response_model=MfaEnrollmentResponse)
def enroll_mfa(context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    key = get_settings().mfa_encryption_key
    if key is None or not key.get_secret_value():
        raise HTTPException(status_code=503, detail="MFA encryption is not configured")
    secret, uri = service.start_mfa_enrollment(context, key.get_secret_value())
    return MfaEnrollmentResponse(secret=secret, provisioning_uri=uri)


@router.post("/me/mfa/confirm", response_model=MfaRecoveryCodesResponse)
def confirm_mfa(data: MfaConfirmRequest, context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    key = get_settings().mfa_encryption_key
    if key is None or not key.get_secret_value():
        raise HTTPException(status_code=503, detail="MFA encryption is not configured")
    codes = service.confirm_mfa_enrollment(context, data.code, key.get_secret_value())
    if codes is None:
        raise HTTPException(status_code=400, detail="Invalid authenticator code")
    return MfaRecoveryCodesResponse(recovery_codes=codes)


@router.post("/me/mfa/disable", response_model=AccountResponse)
def disable_mfa(data: MfaDisableRequest, context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    if not service.disable_mfa(context, data.password):
        raise HTTPException(status_code=401, detail="Invalid password")
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


def require_recipe_editor(context: Annotated[AuthContext, Depends(require_auth)]) -> AuthContext:
    if context.role not in {FamilyRole.OWNER, FamilyRole.EDITOR}:
        raise HTTPException(status_code=403, detail="Recipe editing permission required")
    return context


def require_planner_editor(context: Annotated[AuthContext, Depends(require_auth)]) -> AuthContext:
    if context.role not in {FamilyRole.OWNER, FamilyRole.EDITOR, FamilyRole.PLANNER}:
        raise HTTPException(status_code=403, detail="Planner editing permission required")
    return context


def family_settings_response(context: AuthContext) -> FamilySettingsResponse:
    return FamilySettingsResponse(
        household_size=context.family.household_size,
        leftovers_enabled=context.family.leftovers_enabled,
        cooking_mode_enabled=context.family.cooking_mode_enabled,
        plan_reminders_enabled=context.family.plan_reminders_enabled,
        plan_reminder_weeks=context.family.plan_reminder_weeks,
        enabled_meal_types=context.family.enabled_meal_types,
    )


@router.get("/family/settings", response_model=FamilySettingsResponse)
def family_settings(context: Annotated[AuthContext, Depends(require_auth)]):
    return family_settings_response(context)


@router.put("/family/settings", response_model=FamilySettingsResponse)
def update_family_settings(data: FamilySettingsUpdate, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    service.update_family_settings(context.family, **data.model_dump())
    return family_settings_response(context)


@router.get("/family/recipe-types", response_model=list[RecipeTypeResponse])
def family_recipe_types(context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    return [RecipeTypeResponse(id=item.id, name=item.name, meal_type=item.meal_type) for item in service.list_recipe_types(context.family.id)]


@router.post("/family/recipe-types", response_model=RecipeTypeResponse, status_code=status.HTTP_201_CREATED)
def create_family_recipe_type(data: RecipeTypeCreate, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        item = service.create_recipe_type(context.family.id, data.name, data.meal_type)
    except ValueError:
        raise HTTPException(status_code=409, detail="This recipe type already exists") from None
    return RecipeTypeResponse(id=item.id, name=item.name, meal_type=item.meal_type)


@router.delete("/family/recipe-types/{recipe_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family_recipe_type(recipe_type_id: int, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]) -> Response:
    try:
        deleted = service.delete_recipe_type(context.family.id, recipe_type_id)
    except ValueError:
        raise HTTPException(status_code=409, detail="This recipe type is used by saved recipes") from None
    if not deleted:
        raise HTTPException(status_code=404, detail="Recipe type not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/admin/invitations", response_model=list[ManagedInvitationResponse])
def managed_invitations(context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    return [
        ManagedInvitationResponse(id=item.id, intended_email=item.intended_email or "", expires_at=item.expires_at.isoformat(), role=item.role)
        for item in service.list_pending_invitations(context.family.id)
    ]


@router.get("/admin/security-events", response_model=list[SecurityEventResponse])
def security_events(context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    return [SecurityEventResponse(id=item.id, event_type=item.event_type, user_email=item.user.email if item.user else None, created_at=item.created_at.isoformat()) for item in service.list_security_events(context.family.id)]


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


@router.post("/admin/members/{user_id}/password-reset", response_model=PasswordResetLinkResponse)
def create_password_reset(user_id: int, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    result = service.create_password_reset(context, user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    reset, token = result
    return PasswordResetLinkResponse(token=token, intended_email=reset.user.email, expires_at=reset.expires_at.isoformat())


@router.get("/password-resets/{token}", response_model=PasswordResetPreviewResponse)
def password_reset_preview(token: str, service: Annotated[AuthService, Depends(get_auth_service)]):
    reset = service.get_password_reset(token)
    if reset is None:
        raise HTTPException(status_code=404, detail="Password reset link is invalid or expired")
    return PasswordResetPreviewResponse(intended_email=reset.user.email)


@router.post("/password-resets/{token}", status_code=status.HTTP_204_NO_CONTENT)
def complete_password_reset(token: str, data: PasswordResetRequest, service: Annotated[AuthService, Depends(get_auth_service)]):
    if service.complete_password_reset(token, data.password) is None:
        raise HTTPException(status_code=404, detail="Password reset link is invalid or expired")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/admin/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(user_id: int, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]) -> Response:
    if not service.remove_member(context.family.id, user_id):
        raise HTTPException(status_code=404, detail="Family member not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/admin/members/{user_id}/role", response_model=FamilyMemberResponse)
def update_member_role(user_id: int, data: FamilyMemberRoleUpdate, context: Annotated[AuthContext, Depends(require_owner)], service: Annotated[AuthService, Depends(get_auth_service)]):
    membership = service.update_member_role(context.family.id, user_id, FamilyRole(data.role))
    if membership is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    return FamilyMemberResponse(
        id=membership.user.id,
        email=membership.user.email,
        display_name=membership.user.display_name,
        role=membership.role,
        active_sessions=service.count_sessions(membership.user.id, context.family.id),
    )


@router.post("/family/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(data: InvitationCreateRequest, context: Annotated[AuthContext, Depends(require_auth)], service: Annotated[AuthService, Depends(get_auth_service)]):
    if context.role is not FamilyRole.OWNER:
        raise HTTPException(status_code=403, detail="Only a family owner can invite members")
    try:
        invitation, token = service.create_invitation(context, data.email, FamilyRole(data.role))
    except ValueError:
        raise HTTPException(status_code=409, detail="An account already exists for this email") from None
    return InvitationResponse(
        token=token,
        family_name=context.family.name,
        intended_email=invitation.intended_email or "",
        expires_at=invitation.expires_at.isoformat(),
        role=invitation.role,
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
        role=invitation.role,
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
