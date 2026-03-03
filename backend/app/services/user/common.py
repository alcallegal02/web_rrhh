from typing import Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from app.models.user import User, UserRole, UserResponse, UserSummary

ROLE_RANK = {
    UserRole.SUPERADMIN: 2,
    UserRole.RRHH: 1,
    UserRole.EMPLEADO: 0,
}

def can_manage(actor_role: UserRole, target_role: UserRole) -> bool:
    return ROLE_RANK.get(actor_role, -1) >= ROLE_RANK.get(target_role, -1)

def ensure_not_protected(target: User, actor: User):
    if target.role == UserRole.SUPERADMIN.value and actor.role != UserRole.SUPERADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes modificar ni eliminar al superadmin",
        )

def extract_allowance_fields(payload) -> Dict:
    fields = [
        "vac_days", "vac_hours", "asuntos_propios_days", "asuntos_propios_hours",
        "dias_compensados_days", "dias_compensados_hours", "med_gral_days", "med_gral_hours",
        "med_especialista_days", "med_especialista_hours", "licencia_retribuida_days", "licencia_retribuida_hours",
        "bolsa_horas_days", "bolsa_horas_hours", "horas_sindicales_days", "horas_sindicales_hours"
    ]
    data = {}
    for f in fields:
        val = getattr(payload, f, None)
        if val is not None:
            data[f] = val
    return data

def map_to_response(user: User, audit_names: Dict[UUID, str] = None) -> UserResponse:
    resp = UserResponse.model_validate(user, from_attributes=True)
    
    # Ensure full_name is populated (property might not be caught by model_validate in some versions)
    resp.full_name = user.full_name
    
    # Map Relation Names
    if user.department:
        resp.department_name = user.department.name
    if user.position:
        resp.position_name = user.position.name

    resp.managers = [UserSummary(id=m.manager.id, first_name=m.manager.first_name, last_name=m.manager.last_name, full_name=m.manager.full_name) for m in user.managers_links if m.manager]
    resp.rrhh_responsibles = [UserSummary(id=r.rrhh_member.id, first_name=r.rrhh_member.first_name, last_name=r.rrhh_member.last_name, full_name=r.rrhh_member.full_name) for r in user.rrhh_links if r.rrhh_member]
    
    if user.parent:
        resp.parent = UserSummary(
            id=user.parent.id, 
            first_name=user.parent.first_name, 
            last_name=user.parent.last_name, 
            full_name=user.parent.full_name
        )
    
    # Audit names resolution
    
    if audit_names:
        if user.created_by: resp.created_by_name = audit_names.get(user.created_by)
        if user.updated_by: resp.updated_by_name = audit_names.get(user.updated_by)
        
    return resp
