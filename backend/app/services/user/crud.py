from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.user import (
    User,
    UserAttachment,
    UserCreate,
    UserManagerLink,
    UserResponse,
    UserRole,
    UserRrhhLink,
    UserUpdate,
)
from app.services.auth import get_password_hash
from app.services.user.common import (
    can_manage,
    ensure_not_protected,
    extract_allowance_fields,
    map_to_response,
)
from app.utils.security import encrypt_password
from app.services.user.query import get_user_with_relations
from app.utils.file_ops import delete_file_from_disk


async def _update_links(session: AsyncSession, user: User, manager_ids: list[UUID] | None, rrhh_ids: list[UUID] | None):
    if manager_ids:
        for mid in manager_ids:
            session.add(UserManagerLink(user_id=user.id, manager_id=mid))
    if rrhh_ids:
        for rid in rrhh_ids:
            session.add(UserRrhhLink(user_id=user.id, rrhh_id=rid))
    # Removed commit to ensure atomicity in caller

async def _replace_links(session: AsyncSession, user: User, manager_ids: list[UUID] | None, rrhh_ids: list[UUID] | None):
    # This requires clearing existing links first.
    # We rely on SQLAlchemy's cascade and collection management if eager loaded.
    # Assuming user.managers_links is populated.
    
    if manager_ids is not None:
        # Replace
        user.managers_links = [UserManagerLink(user_id=user.id, manager_id=mid) for mid in manager_ids]
    
    if rrhh_ids is not None:
        user.rrhh_links = [UserRrhhLink(user_id=user.id, rrhh_id=rid) for rid in rrhh_ids]

async def _update_attachments_create(session: AsyncSession, user: User, attachments: list[dict]):
    for att in attachments:
        session.add(UserAttachment(
            user_id=user.id,
            file_url=att['file_url'],
            file_original_name=att.get('file_original_name')
        ))
    # Removed commit

async def _sync_attachments(session: AsyncSession, user: User, new_attachments_data: list[dict]):
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

async def create_user(session: AsyncSession, payload: UserCreate, current_user: User, ip_address: str | None = None) -> UserResponse:
    actor_role = UserRole(current_user.role)
    target_role = payload.role

    if actor_role not in [UserRole.SUPERADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if not can_manage(actor_role, target_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes crear un rol superior al tuyo")
    if target_role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No se pueden crear usuarios superadmin")

    password_hash = get_password_hash(payload.password)
    password_encrypted = encrypt_password(payload.password)

    user_kwargs = dict(
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
        can_manage_complaints=payload.can_manage_complaints,
        notif_own_requests=payload.notif_own_requests,
        notif_managed_requests=payload.notif_managed_requests,
        notif_complaints=payload.notif_complaints,
        notif_news=payload.notif_news,
        password_encrypted=password_encrypted,
        # Allowances
        **extract_allowance_fields(payload)
    )
    if payload.id:
        user_kwargs["id"] = payload.id

    user = User(**user_kwargs)

    session.add(user)
    await session.flush() # Generate ID without committing
    
    # Links
    await _update_links(session, user, payload.managers, payload.rrhh_ids)
    
    # Attachments
    if payload.attachments:
        await _update_attachments_create(session, user, payload.attachments)

    # 3. Auto-allocate Featured Policies Quotas
    # We fetch featured policies and map their duration to user allowance fields if slugs match
    from app.models.policy import PermissionPolicy
    res_policies = await session.execute(select(PermissionPolicy).where(PermissionPolicy.is_featured == True, PermissionPolicy.is_active == True))
    featured_policies = res_policies.scalars().all()
    
    # Map from slug to user field
    slug_to_field = {
        "vacaciones": "vac_days",
        "asuntos_propios": "asuntos_propios_days",
        "medico_general": "med_gral_days",
        "medico_especialista": "med_esp_hours",
        "dias_compensados": "dias_comp_days",
        "licencia_retribuida": "lic_retrib_days",
        "bolsa_horas": "bolsa_horas_hours",
        "horas_sindicales": "horas_sindicales_hours",
        "maternidad_paternidad": "mat_pat_weeks"
    }
    
    for p in featured_policies:
        field_name = slug_to_field.get(p.slug)
        if field_name:
            # Check if payload provided 0 or None, then use policy default
            payload_value = getattr(payload, field_name, 0)
            if not payload_value: # If 0 or None
                setattr(user, field_name, p.duration_value)

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
    resp = map_to_response(user, include_password=True)
    resp.created_by_name = current_user.full_name
    resp.updated_by_name = current_user.full_name
    return resp

async def update_user(session: AsyncSession, user_id: str, payload: UserUpdate, current_user: User, ip_address: str | None = None) -> UserResponse:
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
    old_state_dict = target.model_dump()
    
    # Update Basic Fields
    if payload.username is not None: target.username = payload.username
    if payload.first_name is not None: target.first_name = payload.first_name
    if payload.last_name is not None: target.last_name = payload.last_name
    if payload.password: 
        target.password_hash = get_password_hash(payload.password)
        target.password_encrypted = encrypt_password(payload.password)
    if payload.role: target.role = payload.role.value
    if payload.is_active is not None: target.is_active = payload.is_active
    if payload.department_id is not None: target.department_uuid = payload.department_id
    if payload.position_id is not None: target.position_uuid = payload.position_id
    if payload.parent_id is not None: target.parent_id = payload.parent_id
    if payload.can_manage_complaints is not None: target.can_manage_complaints = payload.can_manage_complaints
    if payload.notif_own_requests is not None: target.notif_own_requests = payload.notif_own_requests
    if payload.notif_managed_requests is not None: target.notif_managed_requests = payload.notif_managed_requests
    if payload.notif_complaints is not None: target.notif_complaints = payload.notif_complaints
    if payload.notif_news is not None: target.notif_news = payload.notif_news

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
        if target.contract_expiration_date is None or target.contract_expiration_date > datetime.now(timezone.utc):
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

    # Relationships
    if payload.managers is not None or payload.rrhh_ids is not None:
            await _replace_links(session, target, payload.managers, payload.rrhh_ids)

    # Attachments Sync
    if payload.attachments is not None:
        await _sync_attachments(session, target, payload.attachments)

    target.updated_by = current_user.id
    
    # Audit Log
    from app.services.audit import generate_diff, log_action
    
    # Capture final state for diffing using utility
    new_state_dict = target.model_dump()
    diffs = generate_diff(old_state_dict, new_state_dict)
    
    if diffs:
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
    
    await session.commit()
    
    # Refresh
    target = await get_user_with_relations(session, target.id)
    return map_to_response(target, include_password=True)


async def delete_user(session: AsyncSession, user_id: str, current_user: User, ip_address: str | None = None):
    user_uuid = UUID(user_id)
    # Load with relations to capture full snapshot
    target = await get_user_with_relations(session, user_uuid)
    
    if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    actor_role = UserRole(current_user.role)
    if target.role == UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No se puede eliminar al superadmin")

    ensure_not_protected(target, current_user)
    if not can_manage(actor_role, UserRole(target.role)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes eliminar un rol superior al tuyo")

    # Capture Full Snapshot for Audit BEFORE deletion
    snapshot = target.model_dump()
    # Serialize UUIDs and datetimes for JSON
    snapshot['id'] = str(snapshot['id'])
    if snapshot.get('contract_expiration_date'):
        snapshot['contract_expiration_date'] = snapshot['contract_expiration_date'].isoformat()
    if snapshot.get('created_at'):
        snapshot['created_at'] = snapshot['created_at'].isoformat()
    if snapshot.get('updated_at'):
        snapshot['updated_at'] = snapshot['updated_at'].isoformat()

    # Cleanup Files (Entire folder)
    from app.utils.file_ops import delete_entity_folders
    await delete_entity_folders("users", str(user_uuid))

    await session.delete(target)
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=current_user.id,
        action="DELETE",
        module="USUARIOS",
        details={
            "deleted_user_id": str(user_uuid),
            "deleted_username": target.username,
            "full_snapshot": snapshot
        },
        ip_address=ip_address
    )
    
    await session.commit()
