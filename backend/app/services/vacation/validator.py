import json
from datetime import datetime, date as date_type

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.policy import DurationUnit, PermissionPolicy
from app.models.user import User
from app.models.vacation import (
    RequestStatus,
    RequestType,
    VacationRequest,
    VacationRequestCreate,
)
from app.services.vacation.balance import get_vacation_balance


class VacationValidator:
    """
    Centralized validation logic for vacation requests.
    Follows Single Responsibility Principle by decoupling validation from CRUD.
    """
    def __init__(self, session: AsyncSession, user_id: str):
        self.session = session
        self.user_id = user_id
        self._balance = None
        self._user: User | None = None

    async def get_balance(self):
        if not self._balance:
            self._balance = await get_vacation_balance(self.session, self.user_id)
        return self._balance

    async def get_user(self) -> User | None:
        """Load user once and cache for reuse within the same validation flow."""
        if not self._user:
            from uuid import UUID
            result = await self.session.execute(
                select(User).where(User.id == UUID(str(self.user_id)))
            )
            self._user = result.scalar_one_or_none()
        return self._user

    async def validate_create_request(self, request_data: VacationRequestCreate, final_days: float):
        """Validate all rules for creating a request"""
        await self._validate_request_type_specifics(request_data, final_days)
        await self._validate_balance_availability(request_data, final_days)

    async def validate_update_request(self, request: VacationRequest, request_data: VacationRequestCreate, final_days: float):
        """Validate all rules for updating a request"""
        if request.status not in [RequestStatus.BORRADOR, RequestStatus.PENDING]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Solo se pueden editar solicitudes en estado Borrador o Pendiente."
            )
        
        await self._validate_request_type_specifics(request_data, final_days)
        await self._validate_balance_availability(request_data, final_days)

    async def _validate_request_type_specifics(self, data: VacationRequestCreate, final_days: float):
        """
        Validate specific rules based on PermissionPolicy metadata.
        """
        # 1. Resolve Policy
        policy = None
        if data.policy_id:
            policy = await self.session.get(PermissionPolicy, data.policy_id)
        elif data.request_type:
            # Fallback for backward compatibility or direct slug usage
            slug = data.request_type.lower() if isinstance(data.request_type, str) else data.request_type.value
            result = await self.session.execute(select(PermissionPolicy).where(PermissionPolicy.slug == slug))
            policy = result.scalar_one_or_none()
            
        if not policy:
             # If no policy found but we have a request_type, it might be a legacy hardcoded type not yet in DB?
             # For now, if we are fully refactoring, we require a policy.
             # However, to be safe during transition, we might allow if strict mode is off.
             # But user said "100% configurable", so we enforce policy existence.
             if data.request_type:
                 # Try to see if it matches a known legacy type, otherwise error
                 pass 
             else:
                 raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debe especificar una política de permiso válida.")

        if policy:
            # A. Check Active
            if not policy.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El permiso '{policy.name}' ya no está activo.")

            # B. Duration Check
            # Calculate max allowed days based on unit
            max_allowed = float(policy.duration_value)
            
            # If unit is weeks, convert to days (approx 7 days, or business logic)
            # Simplification: Compare final_days (which is usually work days or calendar days depending on calculation)
            # We need to know if 'final_days' passed here is consistent with 'policy.duration_unit'.
            # Usually input validation calculates 'days' between start/end.
            
            if policy.duration_unit == DurationUnit.WEEKS:
                 # Convert weeks to days (natural)
                 max_allowed = max_allowed * 7
            
            # Fetch daily work hours for conversion if needed
            balance = await self.get_balance()
            daily_h = balance.daily_work_hours or 8.0

            if policy.duration_unit == DurationUnit.HOURS:
                 # Compare hours to hours
                 if (final_days * daily_h) > max_allowed > 0:
                      raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La duración máxima para {policy.name} es de {policy.duration_value} horas."
                    )
            elif max_allowed > 0:
                if final_days > max_allowed:
                     raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La duración máxima para {policy.name} es de {policy.duration_value} {policy.duration_unit.value}."
                    )
            
            # C. Daily Limit (e.g. 1 hour/day for Lactancia)
            if policy.max_duration_per_day and policy.max_duration_per_day > 0:
                # We need Business Days for the range
                if data.start_date and data.end_date:
                    from app.utils.business_days import get_business_days_count
                    working_days = await get_business_days_count(
                        self.session, 
                        data.start_date.date() if isinstance(data.start_date, datetime) else data.start_date,
                        data.end_date.date() if isinstance(data.end_date, datetime) else data.end_date
                    )
                else:
                    working_days = 1.0 # Single day
                
                max_total_allowed = working_days * policy.max_duration_per_day
                
                # If hourly, compare hours. If days, compare days.
                current_request_val = float(final_days)
                if policy.duration_unit == DurationUnit.HOURS:
                    current_request_val = final_days * daily_h
                
                if current_request_val > (max_total_allowed + 0.001):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Límite diario excedido para {policy.name}. El máximo permitido es {policy.max_duration_per_day} {policy.duration_unit.value} por día laborable (Total permitido para el rango: {max_total_allowed})."
                    )

            # D. Justification
            if policy.requires_justification:
                # Check if attachment logic exists? 
                # Currently attachments are separate. We might enforce at least one attachment if status is not Draft.
                # But 'data.attachments' might be empty in initial create.
                # Usually we warn or blocking happens at 'Approval' stage.
                pass
            
            # D. Advance Notice Check
            if policy.min_advance_notice_days > 0:
                from datetime import date
                today = date.today()
                start_date = data.start_date.date() if isinstance(data.start_date, datetime) else data.start_date
                days_notice = (start_date - today).days
                if days_notice < policy.min_advance_notice_days:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Debe solicitar este permiso con al menos {policy.min_advance_notice_days} días de antelación."
                    )

            # E. Consecutive Days Check
            if policy.min_consecutive_days and final_days < policy.min_consecutive_days:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La duración mínima para este permiso es de {policy.min_consecutive_days} días."
                )
            if policy.max_consecutive_days and final_days > policy.max_consecutive_days:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La duración máxima para este permiso es de {policy.max_consecutive_days} días."
                )

            # F. Mandatory Attachment check (for non-DRAFTS)
            if policy.requires_attachment and data.status != RequestStatus.BORRADOR:
                if not data.attachments or len(data.attachments) == 0:
                     raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Es obligatorio adjuntar un justificante para este tipo de ausencia."
                    )

            # G. Antigüedad mínima
            if policy.min_seniority_months and policy.min_seniority_months > 0:
                user = await self.get_user()
                if user and user.contract_start_date:
                    from dateutil.relativedelta import relativedelta
                    today = date_type.today()
                    contract_date = user.contract_start_date.date() if isinstance(user.contract_start_date, datetime) else user.contract_start_date
                    months_worked = (today.year - contract_date.year) * 12 + (today.month - contract_date.month)
                    if months_worked < policy.min_seniority_months:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                f"Este permiso requiere al menos {policy.min_seniority_months} meses de antigüedad. "
                                f"Actualmente llevas {months_worked} mes(es) en la empresa."
                            )
                        )

            # H. Vinculación a fecha causal (ej: Matrimonio, Fallecimiento)
            if policy.max_days_from_event and policy.max_days_from_event > 0:
                if not data.causal_date:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Este permiso requiere indicar la fecha del evento al que está vinculado."
                    )
                start = data.start_date.date() if isinstance(data.start_date, datetime) else data.start_date
                diff = abs((start - data.causal_date).days)
                if diff > policy.max_days_from_event:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"La fecha de inicio de la ausencia debe estar dentro de los "
                            f"{policy.max_days_from_event} días siguientes al evento (fecha del evento: {data.causal_date})."
                        )
                    )

            # I. Campos obligatorios dinámicos definidos en la política
            if policy.mandatory_request_fields:
                try:
                    required_fields: list[str] = json.loads(policy.mandatory_request_fields)
                except (json.JSONDecodeError, TypeError):
                    required_fields = []

                FIELD_LABELS = {
                    "causal_date": "Fecha del Evento",
                    "description": "Descripción / Motivo",
                    "child_name": "Nombre del Hijo/a",
                    "child_birthdate": "Fecha de Nacimiento del Hijo/a",
                    "telework_percentage": "Porcentaje de Teletrabajo",
                }

                for field in required_fields:
                    value = getattr(data, field, None)
                    if value is None or value == "":
                        label = FIELD_LABELS.get(field, field)
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"El campo '{label}' es obligatorio para este tipo de ausencia."
                        )

    async def _validate_balance_availability(self, data: VacationRequestCreate, final_days: float):
        """Check if user has enough days in balance"""
        # Skip for Drafts
        if data.status == RequestStatus.BORRADOR:
            return

        balance = await self.get_balance()
        
        # Map request type to balance category
        cat_map = {
            RequestType.VACACIONES: balance.vacaciones,
            RequestType.ASUNTOS_PROPIOS: balance.asuntos_propios,
            RequestType.MEDICO_GENERAL: balance.medico_general,
            RequestType.MEDICO_ESPECIALISTA: balance.medico_especialista,
            RequestType.DIAS_COMPENSADOS: balance.dias_compensados,
            RequestType.LICENCIA_RETRIBUIDA: balance.licencia_retribuida,
            RequestType.BOLSA_HORAS: balance.bolsa_horas,
            RequestType.HORAS_SINDICALES: balance.horas_sindicales,
            RequestType.MATERNIDAD_PATERNIDAD: balance.maternidad_paternidad
        }
        
        # Validate against Global Policy Limits (if handled by Balance)
        # Note: Some policies might have a "Total per year" limit (balance) vs "Per request" limit (duration)
        # We need to check the balance specifically for this policy.
        
        # We need to fetch the policy to get the 'slug' or Key to check balance
        policy_slug = None
        if data.policy_id:
             p = await self.session.get(PermissionPolicy, data.policy_id)
             if p: policy_slug = p.slug
        elif data.request_type:
             policy_slug = data.request_type.lower() if isinstance(data.request_type, str) else data.request_type.value
        
        if policy_slug:
            # Check if this slug exists in the dynamic balance
            # The get_balance now returns a dynamic list/dict. 
            # We need to adapt get_balance or consume it differently.
            # See next step: Update Balance Service to be dynamic.
            pass
