from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.models.user import User, UserRole, UserResponse, UserManagerLink, UserRrhhLink
from app.services.user.common import map_to_response

async def get_user_with_relations(session: AsyncSession, user_id: UUID) -> User:
    result = await session.execute(
        select(User)
        .where(User.id == user_id)
        .where(User.id == user_id)
        .options(
            selectinload(User.attachments),
            selectinload(User.parent),
            selectinload(User.managers_links).selectinload(UserManagerLink.manager),
            selectinload(User.rrhh_links).selectinload(UserRrhhLink.rrhh_member)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user

async def list_users(session: AsyncSession, actor_role: UserRole) -> List[UserResponse]:
    query = select(User).options(
        selectinload(User.attachments),
        selectinload(User.parent),
        selectinload(User.managers_links).selectinload(UserManagerLink.manager),
        selectinload(User.rrhh_links).selectinload(UserRrhhLink.rrhh_member)
    )
    if actor_role == UserRole.RRHH:
        query = query.where(User.role.in_([UserRole.RRHH.value, UserRole.EMPLEADO.value]))
    
    query = query.order_by(User.created_at.desc())
    users = (await session.execute(query)).scalars().all()

    # Audit Name Resolution (1+1 Optimization)
    audit_ids = set()
    for u in users:
        if u.created_by: audit_ids.add(u.created_by)
        if u.updated_by: audit_ids.add(u.updated_by)
        
    audit_names = {}
    if audit_ids:
        audit_res = await session.execute(select(User.id, User.first_name, User.last_name).where(User.id.in_(audit_ids)))
        for row in audit_res:
            audit_names[row.id] = f"{row.first_name} {row.last_name}"

    response = []
    for u in users:
        u_response = map_to_response(u, audit_names)
        response.append(u_response)
        
    return response
