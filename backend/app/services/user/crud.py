from datetime import datetime
from typing import Optional, List, Any, Dict
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.models.user import User, UserCreate, UserUpdate, UserRole, UserResponse, UserManagerLink, UserRrhhLink, UserAttachment
from app.services.auth import get_password_hash
from app.utils.file_ops import delete_file_from_disk
from app.services.user.common import ROLE_RANK, can_manage, ensure_not_protected, extract_allowance_fields, map_to_response
from app.services.user.query import get_user_with_relations

async def _update_links(session: AsyncSession, user: User, manager_ids: Optional[List[UUID]], rrhh_ids: Optional[List[UUID]]):
    if manager_ids:
        for mid in manager_ids:
            session.add(UserManagerLink(user_id=user.id, manager_id=mid))
    if rrhh_ids:
        for rid in rrhh_ids:
            session.add(UserRrhhLink(user_id=user.id, rrhh_id=rid))
    # Removed commit to ensure atomicity in caller

async def _replace_links(session: AsyncSession, user: User, manager_ids: Optional[List[UUID]], rrhh_ids: Optional[List[UUID]]):
    # This requires clearing existing links first.
    # We rely on SQLAlchemy's cascade and collection management if eager loaded.
    # Assuming user.managers_links is populated.
    
    if manager_ids is not None:
        # Replace
        user.managers_links = [UserManagerLink(user_id=user.id, manager_id=mid) for mid in manager_ids]
    
    if rrhh_ids is not None:
        user.rrhh_links = [UserRrhhLink(user_id=user.id, rrhh_id=rid) for rid in rrhh_ids]

async def _update_attachments_create(session: AsyncSession, user: User, attachments: List[dict]):
    for att in attachments:
        session.add(UserAttachment(
            user_id=user.id,
            file_url=att['file_url'],
            file_original_name=att.get('file_original_name')
        ))
    # Removed commit

async def _sync_attachments(session: AsyncSession, user: User, new_attachments_data: List[dict]):
    current_attachments = user.attachments
    current_urls = {att.file_url for att in current_attachments}
    # new_urls = {att['file_url'] for att in new_attachments_data} # Unused var

    # Remove
    # Note: Logic here requires knowing if item is in new list.
    new_urls_set = {att['file_url'] for att in new_attachments_data}

    for att in current_attachments:
        if att.file_url not in new_urls_set:
            await session.delete(att)
            await delete_file_from_disk(att.file_url)
    
    # Add
    for att_data in new_attachments_data:
        if att_data['file_url'] not in current_urls:
            session.add(UserAttachment(
                user_id=user.id,
                file_url=att_data['file_url'],
                file_original_name=att_data.get('file_original_name')
            ))

def _enforce_superadmin_immutable(payload: UserUpdate):
    if payload.role and payload.role != UserRole.SUPERADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No se puede cambiar el rol del superadmin")
    
    payload.department_id = None
    payload.position_id = None
    payload.managers = []
    payload.rrhh_ids = []
    for f in extract_allowance_fields(payload).keys():
        setattr(payload, f, 0)

async def create_user(session: AsyncSession, payload: UserCreate, current_user: User, ip_address: Optional[str] = None) -> UserResponse:
    actor_role = UserRole(current_user.role)
    target_role = payload.role

    if actor_role not in [UserRole.SUPERADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if not can_manage(actor_role, target_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes crear un rol superior al tuyo")
    if target_role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No se pueden crear usuarios superadmin")

    password_hash = get_password_hash(payload.password)

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=password_hash,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=target_role.value,
        department_uuid=payload.department_id,
        position_uuid=payload.position_id,
        photo_url=payload.photo_url,
        contract_expiration_date=payload.contract_expiration_date.replace(tzinfo=None) if payload.contract_expiration_date else None,
        created_by=current_user.id,
        updated_by=current_user.id,
        parent_id=payload.parent_id,
        # Allowances
        **extract_allowance_fields(payload)
    )

    session.add(user)
    await session.flush() # Generate ID without committing
    
    # Links
    await _update_links(session, user, payload.managers, payload.rrhh_ids)
    
    # Attachments
    if payload.attachments:
        await _update_attachments_create(session, user, payload.attachments)

    await session.commit()
    await session.refresh(user)

    # Refresh full object
    user = await get_user_with_relations(session, user.id)
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=current_user.id,
        action="CREATE",
        module="USUARIOS",
        details={
            "created_user_id": str(user.id),
            "created_username": user.username,
            "created_email": user.email,
            "role": user.role
        },
        ip_address=ip_address
    )

    # Responses need mapped fields
    resp = map_to_response(user)
    resp.created_by_name = current_user.full_name
    resp.updated_by_name = current_user.full_name
    return resp

async def update_user(session: AsyncSession, user_id: str, payload: UserUpdate, current_user: User, ip_address: Optional[str] = None) -> UserResponse:
    user_uuid = UUID(user_id)
    target = await get_user_with_relations(session, user_uuid)
    actor_role = UserRole(current_user.role)

    ensure_not_protected(target, current_user)

    # Permission Checks
    target_role = UserRole(target.role)
    if payload.role:
        if not can_manage(actor_role, payload.role):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes asignar un rol superior al tuyo")
        target_role = payload.role

    if not can_manage(actor_role, UserRole(target.role)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes modificar un rol superior al tuyo")

    # Superadmin Restrictions
    if target_role == UserRole.SUPERADMIN:
            _enforce_superadmin_immutable(payload)
    
    # Capture Old State for Diff
    # old_state = target.model_dump()
    
    diffs = {}
    
    # Helper to check diff
    def check_diff(field: str, new_val: Any, old_val: Any):
        if new_val is not None:
            s_new = str(new_val) if isinstance(new_val, UUID) else new_val
            s_old = str(old_val) if isinstance(old_val, UUID) else old_val
            
            if s_new != s_old:
                diffs[field] = {"old": s_old, "new": s_new}

    check_diff('username', payload.username, target.username)
    check_diff('first_name', payload.first_name, target.first_name)
    check_diff('last_name', payload.last_name, target.last_name)
    if payload.role: check_diff('role', payload.role.value, target.role)
    check_diff('is_active', payload.is_active, target.is_active)
    check_diff('department_id', payload.department_id, target.department_uuid)
    check_diff('position_id', payload.position_id, target.position_uuid)
    check_diff('parent_id', payload.parent_id, target.parent_id)
    
    # Update Basic Fields
    if payload.username is not None: target.username = payload.username
    if payload.first_name is not None: target.first_name = payload.first_name
    if payload.last_name is not None: target.last_name = payload.last_name
    if payload.password: target.password_hash = get_password_hash(payload.password)
    if payload.role: target.role = payload.role.value
    if payload.is_active is not None: target.is_active = payload.is_active
    if target.department_id is not None: target.department_uuid = payload.department_id
    if payload.position_id is not None: target.position_uuid = payload.position_id
    if payload.parent_id is not None: target.parent_id = payload.parent_id

    # Photo
    if payload.photo_url is not None:
        if target.photo_url and target.photo_url != payload.photo_url:
            await delete_file_from_disk(target.photo_url)
        target.photo_url = payload.photo_url

    # Contract Expiration Logic
    update_data = payload.model_dump(exclude_unset=True)
    if 'contract_expiration_date' in update_data:
        val = update_data['contract_expiration_date']
        new_date = val.replace(tzinfo=None) if val else None
        if target.contract_expiration_date != new_date:
            diffs['contract_expiration_date'] = {
                "old": str(target.contract_expiration_date) if target.contract_expiration_date else None, 
                "new": str(new_date) if new_date else None
            }
        target.contract_expiration_date = new_date
        
        # Auto-activate logic
        if target.contract_expiration_date is None or target.contract_expiration_date > datetime.utcnow():
            target.is_active = True

    # Allowances
    for field, value in extract_allowance_fields(payload).items():
        if value is not None:
            old_v = getattr(target, field, None)
            if old_v != value:
                diffs[field] = {"old": float(old_v) if old_v is not None else 0, "new": float(value)}
            setattr(target, field, value)

    # Relationships
    if payload.managers is not None or payload.rrhh_ids is not None:
            await _replace_links(session, target, payload.managers, payload.rrhh_ids)

    # Attachments Sync
    if payload.attachments is not None:
        await _sync_attachments(session, target, payload.attachments)

    target.updated_by = current_user.id
    await session.commit()
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=current_user.id,
        action="UPDATE",
        module="USUARIOS",
        details={
            "target_user_id": str(target.id),
            "target_username": target.username,
            "changes": diffs
        },
        ip_address=ip_address
    )
    
    # Refresh
    target = await get_user_with_relations(session, target.id)
    return map_to_response(target) # TODO: Audit names? Router can handle? Or we handle if critical.

async def delete_user(session: AsyncSession, user_id: str, current_user: User, ip_address: Optional[str] = None):
    user_uuid = UUID(user_id)
    # Load lightly just for checks, but need attachments to delete
    result = await session.execute(select(User).where(User.id == user_uuid)) # .options(selectinload(User.attachments)))
    target = result.scalar_one_or_none()
    
    if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    actor_role = UserRole(current_user.role)
    if target.role == UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No se puede eliminar al superadmin")

    ensure_not_protected(target, current_user)
    if not can_manage(actor_role, UserRole(target.role)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes eliminar un rol superior al tuyo")

    # Cleanup
    if target.photo_url: await delete_file_from_disk(target.photo_url)
    for att in target.attachments:
        await delete_file_from_disk(att.file_url)

    deleted_username = target.username
    await session.delete(target)
    await session.commit()

    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=current_user.id,
        action="DELETE",
        module="USUARIOS",
        details={
            "deleted_user_id": str(user_uuid),
            "deleted_username": deleted_username
        },
        ip_address=ip_address
    )
