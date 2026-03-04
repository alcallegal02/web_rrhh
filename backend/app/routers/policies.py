from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.policy import (
    PermissionPolicy,
    PermissionPolicyCreate,
    PermissionPolicyUpdate,
)
from app.models.user import User, UserRole
from app.routers.auth import get_current_user

router = APIRouter(tags=["policies"], prefix="/api/policies")

async def ensure_admin(current_user: Annotated[User, Depends(get_current_user)]):
    if current_user.role_enum not in [UserRole.SUPERADMIN, UserRole.RRHH]: # Assuming RRHH is admin-like
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren privilegios de administrador."
        )
    return current_user

@router.get("", response_model=list[PermissionPolicy])
async def list_policies(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)] # Any authenticated user can list policies (to select them)
):
    """List all active policies (or all for admin?)"""
    # Admins see all, users see active only?
    if current_user.role_enum in [UserRole.SUPERADMIN, UserRole.RRHH]:
         result = await session.execute(select(PermissionPolicy))
    else:
         result = await session.execute(select(PermissionPolicy).where(PermissionPolicy.is_active == True))
    
    return result.scalars().all()


@router.get("/my-balances", response_model=list[dict])
async def get_my_balances(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    """
    Get calculated balances (quota, consumed, available) for all active policies 
    based on the current date and user history.
    """
    from app.services.policy_engine import PolicyEngine
    
    # 1. Get all active policies
    policies = await session.execute(select(PermissionPolicy).where(PermissionPolicy.is_active == True))
    policies = policies.scalars().all()
    
    balances = []
    for policy in policies:
        # 2. Calculate balance for each
        # This could be optimized to batch fetch requests, but for MVP loop is fine.
        status = await PolicyEngine.get_policy_balance(session, str(current_user.id), str(policy.id))
        
        balances.append({
            "policy_slug": policy.slug,
            "policy_name": policy.name,
            "reset_type": status["reset_type"],
            "period": {
                "start": status["period_start"],
                "end": status["period_end"]
            },
            "limit": status["limit"],
            "consumed": status["consumed"],
            "available": status["available"],
            "unit": policy.duration_unit,
            "is_public_dashboard": policy.is_public_dashboard,
            # "next_reset": ...
        })
        
    return balances


@router.post("", response_model=PermissionPolicy)
async def create_policy(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(ensure_admin)],
    policy_data: PermissionPolicyCreate
):
    """Create a new permission policy"""
    # Check slug uniqueness
    existing = await session.execute(select(PermissionPolicy).where(PermissionPolicy.slug == policy_data.slug))
    if existing.scalar_one_or_none():
         raise HTTPException(status_code=400, detail="Ya existe una política con ese slug.")
         
    policy = PermissionPolicy.model_validate(policy_data)
    session.add(policy)
    await session.commit()
    await session.refresh(policy)

    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=admin.id,
        action="CREATE",
        module="POLITICAS",
        details={
            "id": str(policy.id),
            "name": policy.name,
            "slug": policy.slug
        },
        ip_address=request.client.host
    )

    return policy

@router.put("/{policy_id}", response_model=PermissionPolicy)
async def update_policy(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(ensure_admin)],
    policy_id: str,
    policy_data: PermissionPolicyUpdate
):
    """Update a permission policy"""
    policy = await session.get(PermissionPolicy, UUID(policy_id))
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada.")
        
    # Capture old state for diffing
    old_state_dict = policy.model_dump()

    policy_data_dict = policy_data.model_dump(exclude_unset=True)
    for key, value in policy_data_dict.items():
        setattr(policy, key, value)
        
    # Audit Log
    from app.services.audit import generate_diff, log_action
    new_state_dict = policy.model_dump()
    diffs = generate_diff(old_state_dict, new_state_dict)

    if diffs:
        await log_action(
            session=session,
            user_id=admin.id,
            action="UPDATE",
            module="POLITICAS",
            details={
                "id": policy_id,
                "name": policy.name,
                "changes": diffs
            },
            ip_address=request.client.host
        )

    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return policy

@router.delete("/{policy_id}")
async def delete_policy(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(ensure_admin)],
    policy_id: str
):
    """Soft delete (deactivate) or hard delete if not system default"""
    policy = await session.get(PermissionPolicy, UUID(policy_id))
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada.")
        
    if policy.is_system_default:
         raise HTTPException(status_code=400, detail="No se pueden eliminar políticas del sistema por defecto. Puede desactivarlas si es necesario.")
         
    # Capture Full Snapshot for Audit BEFORE deletion
    snapshot = policy.model_dump()
    snapshot['id'] = str(snapshot['id'])
    if snapshot.get('created_at'):
        snapshot['created_at'] = snapshot['created_at'].isoformat()
    if snapshot.get('updated_at'):
        snapshot['updated_at'] = snapshot['updated_at'].isoformat()

    # Let's do hard delete but SQL constraints (FKs) might prevent it if requests exist.
    try:
        # Audit Log
        from app.services.audit import log_action
        await log_action(
            session=session,
            user_id=admin.id,
            action="DELETE",
            module="POLITICAS",
            details={
                "id": policy_id,
                "name": policy.name,
                "full_snapshot": snapshot
            },
            ip_address=request.client.host
        )

        await session.delete(policy)
        await session.commit()
    except Exception:
        # Fallback to simple deactivation hint or error
        raise HTTPException(status_code=400, detail="No se puede eliminar porque está en uso. Intente desactivarla.")
        
    return {"status": "deleted"}


@router.get("/{policy_id}/form-schema")
async def get_policy_form_schema(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    policy_id: str
):
    """
    Returns a dynamic schema for the request form based on policy attributes.
    """
    from app.models.policy import Modality, PolicyResetType
    from app.services.policy_engine import PolicyEngine
    
    policy = await session.get(PermissionPolicy, UUID(policy_id))
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada.")

    # Get current balance for this user/policy
    balance = await PolicyEngine.get_policy_balance(session, str(current_user.id), str(policy.id))
    
    schema = {
        "policy_id": str(policy.id),
        "name": policy.name,
        "is_paid": policy.is_paid,
        "description": policy.description,
        "available_balance": balance["available"],
        "unit": policy.duration_unit,
        "max_duration_per_day": policy.max_duration_per_day,
        "fields": []
    }

    # Core fields (always present)
    schema["fields"].append({
        "name": "start_date",
        "type": "datetime",
        "label": "Fecha Inicio",
        "required": True
    })

    if policy.slug != "maternidad_paternidad": # Paternidad has its own custom endDate logic usually
         schema["fields"].append({
            "name": "end_date",
            "type": "datetime",
            "label": "Fecha Fin",
            "required": True # Adjust if some are optional
        })

    # Dynamic fields based on policy
    if policy.requires_justification:
        schema["fields"].append({
            "name": "attachments",
            "type": "file",
            "label": "Justificante Requerido",
            "required": True,
            "helpText": "Debe adjuntar un documento que justifique la ausencia."
        })

    if policy.reset_type == PolicyResetType.POR_EVENTO:
        schema["fields"].append({
            "name": "causal_date",
            "type": "date",
            "label": "Fecha del hecho causante",
            "required": True,
            "helpText": f"Fecha en la que se produjo el evento ({policy.name})."
        })

    if policy.limit_age_child is not None:
        schema["fields"].append({
            "name": "child_name",
            "type": "text",
            "label": "Nombre del menor",
            "required": True
        })
        schema["fields"].append({
            "name": "child_birthdate",
            "type": "date",
            "label": "Fecha de nacimiento del menor",
            "required": True
        })

    if policy.modality == Modality.MIXTO:
        schema["fields"].append({
            "name": "telework_percentage",
            "type": "number",
            "label": "Porcentaje de Teletrabajo",
            "required": True,
            "min": 0,
            "max": 100,
            "helpText": "Indique qué porcentaje del tiempo será en remoto."
        })

    schema["fields"].append({
        "name": "description",
        "type": "textarea",
        "label": "Observaciones",
        "required": False
    })

    return schema
