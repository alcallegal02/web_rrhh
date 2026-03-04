from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User, UserRole
from app.routers.auth import get_current_user

router = APIRouter(prefix="/org-chart", tags=["orgchart"])


@router.get("", response_model=list[dict])
async def get_org_chart(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    # Any authenticated user can access
    # Eager load managers
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(User)
        .where(
            User.role != UserRole.SUPERADMIN.value,
            User.is_active == True,
            # Filter out expired contracts explicitly just in case they haven't been deactivated by login yet
            (User.contract_expiration_date == None) | (User.contract_expiration_date > datetime.utcnow())
        )
        .options(
             selectinload(User.managers_links),
             selectinload(User.department),
             selectinload(User.position)
        )
    )
    users = result.scalars().all()

    # Strings are now direct fields on User. No lookup tables needed.


    nodes = []
    lookup = {}
    for u in users:
        # Use first manager as primary for org chart
        # We access u.managers_links (list of UserManagerLink objects)
        primary_manager_id = None
        if u.managers_links:
             # Just take the first one found
             primary_manager_id = str(u.managers_links[0].manager_id)

        node = {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "position_name": u.position.name if u.position else None,
            "department_name": u.department.name if u.department else None,
            "photo_url": u.photo_url,
            "manager_id": primary_manager_id,
            "children": [],
        }
        lookup[node["id"]] = node
        nodes.append(node)

    roots = []
    for node in nodes:
        mgr = node["manager_id"]
        if mgr and mgr in lookup:
            lookup[mgr]["children"].append(node)
        else:
            roots.append(node)

    return roots

