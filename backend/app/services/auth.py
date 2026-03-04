from datetime import datetime, timedelta

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select as sql_select

from app.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def authenticate_user(session: AsyncSession, identifier: str, password: str) -> User | None:
    """Authenticate a user by username OR email and password"""
    from sqlalchemy import or_
    
    # query once
    query = sql_select(User).where(
        or_(User.email == identifier, User.username == identifier),
        User.is_active == True
    )
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user


# ... (imports)

async def get_user_by_id(session: AsyncSession, user_id: str) -> User | None:
    """Get a user by ID"""
    from uuid import UUID

    
    try:
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        return None

    query = sql_select(User).where(User.id == user_uuid)
    # .options(
    #     selectinload(User.attachments),
    #     selectinload(User.managers_links).selectinload(UserManagerLink.manager),
    #     selectinload(User.rrhh_links).selectinload(UserRrhhLink.rrhh_member)
    # )
    result = await session.execute(query)
    return result.scalar_one_or_none()


# Password Reset Logic

async def request_password_reset(
    session: AsyncSession,
    user: User
) -> None:
    """Generate OTP and send email"""
    import secrets
    import string
    from datetime import timezone

    from app.utils.email import send_password_reset_otp
    
    # 1. Generate 6 digit numeric OTP
    otp = ''.join(secrets.choice(string.digits) for _ in range(6))
    
    # 2. Set expiration (5 minutes)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # 3. Update user
    user.reset_password_otp = otp
    user.reset_password_otp_expires_at = expires_at
    
    session.add(user)
    await session.commit()
    
    # 4. Send Email
    await send_password_reset_otp(user.email, otp)


async def validate_password_reset_otp(
    session: AsyncSession,
    user: User,
    otp: str
) -> bool:
    """Check if OTP is valid and extend if so"""
    from datetime import timezone
    
    if not user.reset_password_otp or not user.reset_password_otp_expires_at:
        return False
        
    if user.reset_password_otp != otp:
        return False
        
    if datetime.now(timezone.utc) > user.reset_password_otp_expires_at:
        return False
        
    # Extend expiration to allow user time to set password (30 minutes)
    user.reset_password_otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    session.add(user)
    await session.commit()
    return True


async def confirm_password_reset(
    session: AsyncSession,
    user: User,
    otp: str,
    new_password: str
) -> None:
    """Verify OTP again and update password"""
    import re
    from datetime import timezone

    from fastapi import HTTPException
    
    # Complexity check
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not re.search(r"\d", new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

    if not user.reset_password_otp or not user.reset_password_otp_expires_at:
        raise HTTPException(status_code=400, detail="No OTP requested")
        
    if user.reset_password_otp != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if datetime.now(timezone.utc) > user.reset_password_otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
        
    # Valid OTP
    user.password_hash = get_password_hash(new_password)
    user.reset_password_otp = None
    user.reset_password_otp_expires_at = None
    
    session.add(user)
    await session.commit()
