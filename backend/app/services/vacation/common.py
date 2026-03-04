from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.user import User, UserResponse


async def get_available_responsibles_for_user(
    session: AsyncSession,
    user_id: str
) -> list[UserResponse]:
    """Get list of assigned managers and RRHH users for a user"""
    user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
    
    result = await session.execute(
        select(User)
        .where(User.id == user_uuid)
        .options(
            # selectinload(User.managers_links).selectinload(UserManagerLink.manager),
            # selectinload(User.rrhh_links).selectinload(UserRrhhLink.rrhh_member),
        )
    )
    user_loaded = result.scalar_one()
    
    responsibles_map = {}
    
    # Add Managers
    # for link in user_loaded.managers_links:
    #     if link.manager.is_active:
    #          responsibles_map[link.manager.id] = link.manager

    # Add RRHH
    # for link in user_loaded.rrhh_links:
    #     if link.rrhh_member.is_active:
    #          responsibles_map[link.rrhh_member.id] = link.rrhh_member
             
    # Convert to response list
    response_list = []
    for u in responsibles_map.values():
        u_dict = u.model_dump()
        u_dict["full_name"] = u.full_name
        u_dict["role"] = u.role
        u_dict["managers"] = []
        u_dict["rrhh_responsibles"] = []
        
        response_list.append(UserResponse.model_validate(u_dict))
            
    return response_list
