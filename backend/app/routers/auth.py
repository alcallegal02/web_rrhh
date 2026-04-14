from typing import Annotated
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models.user import Token, User, UserResponse
from app.services.auth import (
    authenticate_user,
    create_access_token,
    get_user_by_id,
)

router = APIRouter(tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
limiter = Limiter(key_func=get_remote_address)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)]
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await get_user_by_id(session, user_id)
    if user is None:
        raise credentials_exception
        
    # User Life Cycle Check: Contract Expiration
    if user.is_active and user.contract_expiration_date:
        if user.contract_expiration_date < datetime.now(timezone.utc):
            # Auto-deactivate
            user.is_active = False
            session.add(user)
            await session.commit()
            
            # Reject access
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tu contrato ha expirado. Contacta con RRHH.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Login endpoint"""
    user = await authenticate_user(session, form_data.username, form_data.password)
    
    if not user:
        # Audit Failed Login
        from app.services.audit import log_action
        await log_action(
            session=session,
            user_id=None,
            action="LOGIN_FAILED",
            module="AUTH",
            details={"username": form_data.username},
            ip_address=request.client.host
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    # Audit Successful Login
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=user.id,
        action="LOGIN_SUCCESS",
        module="AUTH",
        details={"email": user.email},
        ip_address=request.client.host
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


from app.models.user import (  # Added UserSummary
    Token,
    User,
)

# ...

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    """Get current user information"""
    # Convert to response model manually to handle properties
    # OR better: use validation which works if structure matches.
    # But managers is not in User model directly (it's in managers_links).
    
    resp = UserResponse.model_validate(current_user)
    
    # Populate managers
    # Populate managers
    resp.managers = []
    #     UserSummary(id=link.manager.id, full_name=link.manager.full_name)
    #     for link in current_user.managers_links
    # ]

    # Populate rrhh_responsibles
    resp.rrhh_responsibles = []
    #     UserSummary(id=link.rrhh_member.id, full_name=link.rrhh_member.full_name)
    #     for link in current_user.rrhh_links
    # ]
    
    return resp

    return UserResponse.model_validate(user_dict)



from pydantic import BaseModel


class PasswordChangeRequest(BaseModel):
    pass # No body needed, implicit current user

class PasswordChangeConfirm(BaseModel):
    otp: str
    new_password: str



@router.post("/request-password-change", status_code=status.HTTP_200_OK)
@limiter.limit("3/hour")
async def request_password_change(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """
    Generates an OTP and sends it to the user's email.
    """
    from app.services.auth import request_password_reset
    # Need fresh user for updates
    user = await get_user_by_id(session, str(current_user.id))
    await request_password_reset(session, user)
    return {"message": "OTP sent to email"}

class OTPCheck(BaseModel):
    otp: str

@router.post("/check-password-reset-otp", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def check_password_reset_otp(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: OTPCheck
):
    """
    Checks if the OTP is valid without consuming it.
    """
    from app.services.auth import validate_password_reset_otp
    user = await get_user_by_id(session, str(current_user.id))
    is_valid = await validate_password_reset_otp(session, user, payload.otp)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    return {"message": "OTP is valid"}

@router.post("/confirm-password-change", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def confirm_password_change(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: PasswordChangeConfirm
):
    """
    Verifies OTP and updates password.
    """
    from app.services.auth import confirm_password_reset
    user = await get_user_by_id(session, str(current_user.id))
    await confirm_password_reset(session, user, payload.otp, payload.new_password)
    
    # Audit Password Change
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=user.id,
        action="PASSWORD_CHANGED",
        module="AUTH",
        details={"email": user.email},
        ip_address=request.client.host
    )
    
    return {"message": "Password updated successfully"}
