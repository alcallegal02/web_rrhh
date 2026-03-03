import logging
from sqlmodel import Session, select
from app.models.policy import PermissionPolicy, DurationUnit, Modality, PolicyResetType

logger = logging.getLogger(__name__)

async def seed_default_policies(session: Session):
    """
    Seed valid initial policies. Checks each policy by slug to avoid duplicates.
    """
    try:
        logger.info("Checking permission policies seeding...")
        
        policies = [
            # 1. PERMISOS RETRIBUIDOS
            PermissionPolicy(
                slug="matrimonio",
                name="Matrimonio o Pareja de Hecho",
                description="15 días naturales. Se inicia el primer día laborable tras el evento.",
                duration_value=15,
                duration_unit=DurationUnit.DAYS_NATURAL,
                is_paid=True,
                requires_justification=True,
                requires_document_type="family_book_or_cert",
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                validity_window_value=1,
                validity_window_unit="months",
                color="#8B5CF6", 
                icon="💍"
            ),
            PermissionPolicy(
                slug="enfermedad-grave",
                name="Accidente o Enfermedad Grave",
                description="5 días hábiles. Incluye hospitalización.",
                duration_value=5,
                duration_unit=DurationUnit.DAYS_WORK,
                is_paid=True,
                requires_justification=True,
                requires_document_type="medical_proof",
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#EF4444", 
                icon="🏥"
            ),
            PermissionPolicy(
                slug="fallecimiento",
                name="Fallecimiento de Familiar",
                description="2 días (4 con viaje).",
                duration_value=2,
                duration_unit=DurationUnit.DAYS_WORK,
                is_paid=True,
                requires_justification=True,
                travel_extension_days=2.0,
                requires_document_type="death_cert",
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#1F2937", 
                icon="🖤"
            ),
            PermissionPolicy(
                slug="mudanza",
                name="Mudanza",
                description="1 día por traslado.",
                duration_value=1,
                duration_unit=DurationUnit.DAYS_WORK,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#F59E0B", 
                icon="📦"
            ),
            PermissionPolicy(
                slug="fuerza-mayor",
                name="Fuerza Mayor Familiar",
                description="Urgencias imprevisibles. Hasta 4 días/año.",
                duration_value=0, # Variable
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_CALENDARIO,
                max_days_per_period=4.0,
                allow_split=True,
                split_min_duration=0.125,
                color="#EC4899", 
                icon="🚑"
            ),
            PermissionPolicy(
                slug="permiso-climatico",
                name="Permiso Climático",
                description="Hasta 4 días. Alertas rojas.",
                duration_value=0, # Variable
                duration_unit=DurationUnit.DAYS_WORK, 
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_CALENDARIO,
                max_days_per_period=4.0,
                color="#06B6D4", 
                icon="⛈️"
            ),
            PermissionPolicy(
                slug="vacaciones",
                name="Vacaciones Anuales",
                description="Vacaciones retribuidas anuales estándar.",
                duration_value=22,
                duration_unit=DurationUnit.DAYS_WORK,
                is_paid=True,
                requires_justification=False,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_CALENDARIO,
                max_days_per_period=22.0,
                color="#3B82F6", 
                icon="🏖️",
                is_system_default=True
            ),
            PermissionPolicy(
                slug="deber-inexcusable",
                name="Deber Inexcusable",
                description="Votar, jurado, juzgado.",
                duration_value=0, 
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#4B5563", 
                icon="⚖️"
            ),
            PermissionPolicy(
                slug="examenes",
                name="Exámenes Académicos",
                description="Obtención de títulos oficiales.",
                duration_value=0,
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#6366F1", 
                icon="🎓"
            ),
            PermissionPolicy(
                slug="formacion",
                name="Formación Profesional",
                description="20 horas/año acumulables.",
                duration_value=20,
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_CALENDARIO,
                max_days_per_period=2.5, # 20h
                is_accumulable=True,
                accumulable_years=5,
                color="#10B981", 
                icon="📚"
            ),
            PermissionPolicy(
                slug="prenatal",
                name="Preparación al Parto / Adopción",
                description="Exámenes prenatales.",
                duration_value=0,
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#F472B6", 
                icon="🤰"
            ),
            PermissionPolicy(
                slug="lactancia",
                name="Cuidado del Lactante",
                description="1h/día hasta 9 meses. Acumulable.",
                duration_value=1, 
                duration_unit=DurationUnit.DAYS_WORK,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_RELATIVO, # Starts from birth/event
                validity_window_value=9,
                validity_window_unit="months",
                max_days_per_period=15, # If accumulated
                color="#F9A8D4", 
                icon="🍼"
            ),
            PermissionPolicy(
                slug="busqueda-empleo",
                name="Búsqueda de Empleo",
                description="6 horas/semanales.",
                duration_value=6,
                duration_unit=DurationUnit.HOURS, 
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO, # Tied to dismissal event
                color="#9CA3AF", 
                icon="bs" 
            ),
            PermissionPolicy(
                slug="donacion",
                name="Donación de Sangre/Órganos",
                description="Tiempo indispensable.",
                duration_value=0,
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#DC2626", 
                icon="🩸"
            ),
             PermissionPolicy(
                slug="asuntos-propios",
                name="Asuntos Propios",
                description="Días de libre disposición.",
                duration_value=16, 
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                requires_justification=False,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_CALENDARIO,
                max_days_per_period=2.0,
                color="#10B981", 
                icon="✨"
            ),

            # 2. SUSPENSIONES RETRIBUIDAS (Seguridad Social)
            PermissionPolicy(
                slug="nacimiento",
                name="Nacimiento y Cuidado del Menor",
                description="19 semanas (2026). Intransferible.", 
                duration_value=19,
                duration_unit=DurationUnit.WEEKS,
                is_paid=True, 
                requires_justification=True,
                allow_split=True,
                mandatory_immediate_duration=6.0,
                split_min_duration=1.0,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.ANUAL_RELATIVO,
                validity_window_value=12,
                validity_window_unit="months",
                color="#DB2777", 
                icon="👶",
                is_system_default=True
            ),
            PermissionPolicy(
                slug="riesgo-embarazo",
                name="Riesgo Embarazo/Lactancia",
                description="Suspensión total.",
                duration_value=0, 
                duration_unit=DurationUnit.DAYS_NATURAL,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#FECACA", 
                icon="⚠️"
            ),
            PermissionPolicy(
                slug="it-baja",
                name="Baja por IT",
                description="Enfermedad común.",
                duration_value=0,
                duration_unit=DurationUnit.DAYS_NATURAL,
                is_paid=True,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#EF4444", 
                icon="🤒"
            ),

            # 3. PERMISOS NO RETRIBUIDOS
            PermissionPolicy(
                slug="parental-8-semanas",
                name="Permiso Parental (8 semanas)",
                description="Hasta 8 años. Continuo o discontinuo.",
                duration_value=8,
                duration_unit=DurationUnit.WEEKS,
                is_paid=False,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                # User says "Continuous or discontinuous until 8 years".
                # It's a single pool of 8 weeks per child.
                # So SIN_REINICIO (Single Pool).
                # But tied to child.
                reset_type=PolicyResetType.SIN_REINICIO, 
                validity_window_value=96, # 96 months (8 years)
                validity_window_unit="months",
                allow_split=True,
                split_min_duration=1.0,
                color="#6B7280", 
                icon="🧸"
            ),
            PermissionPolicy(
                slug="excedencia-voluntaria",
                name="Excedencia Voluntaria",
                description="4 meses a 5 años.",
                duration_value=4, 
                duration_unit=DurationUnit.DAYS_NATURAL,
                is_paid=False,
                requires_justification=True,
                modality=Modality.PRESENCIAL_AUSENTE,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#9CA3AF", 
                icon="🚪"
            ),
            PermissionPolicy(
                slug="teletrabajo-formacion",
                name="Teletrabajo por Formación",
                description="Teletrabajo parcial.",
                duration_value=0,
                duration_unit=DurationUnit.HOURS,
                is_paid=True,
                modality=Modality.TELETRABAJO,
                reset_type=PolicyResetType.POR_EVENTO,
                color="#818CF8", 
                icon="💻"
            )
        ]

        added_count = 0
        added_count = 0
        for p in policies:
            # Check if slug exists
            stmt = select(PermissionPolicy).where(PermissionPolicy.slug == p.slug)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if not existing:
                logger.info(f"Adding new policy: {p.slug}")
                session.add(p)
                added_count += 1
            else:
                logger.debug(f"Policy exists: {p.slug}")
        
        if added_count > 0:
            await session.commit()
            logger.info(f"Seeded {added_count} new default policies.")
        else:
            logger.info("All default policies already exist.")

    except Exception as e:
        logger.error(f"Error seeding policies: {e}")
        # Don't raise, just log. allow app to start.

async def seed_test_hierarchy(session: Session):
    """
    Seed a more complex hierarchy for testing (20 users).
    """
    from app.services.auth import get_password_hash
    from app.models.user import User, UserRole, UserManagerLink, UserRrhhLink
    from app.models.organization import Department, Position
    from uuid import UUID

    try:
        logger.info("Starting test hierarchy seeding...")
        
        # 1. Ensure Departments exist
        depts_data = ["Dirección", "RRHH", "Operaciones", "IT", "Ventas", "Marketing", "Logística"]
        depts = {}
        for name in depts_data:
            stmt = select(Department).where(Department.name == name)
            res = await session.execute(stmt)
            d = res.scalar_one_or_none()
            if not d:
                d = Department(name=name)
                session.add(d)
                await session.flush()
            depts[name] = d

        # 2. Ensure Positions exist
        pos_data = ["CEO", "Director RRHH", "Director Operaciones", "IT Manager", "Ventas Manager", 
                    "Mkt Manager", "Logística Manager", "Desarrollador Senior", "Comercial", "Especialista RRHH", "Operario"]
        positions = {}
        for name in pos_data:
            stmt = select(Position).where(Position.name == name)
            res = await session.execute(stmt)
            p = res.scalar_one_or_none()
            if not p:
                p = Position(name=name)
                session.add(p)
                await session.flush()
            positions[name] = p

        # 3. Users definition (20 users)
        users_data = [
            # Direction
            {"username": "juan.ceo", "email": "juan@inespasa.test", "first": "Juan", "last": "García", "role": "superadmin", "dept": "Dirección", "pos": "CEO"},
            
            # Directors
            {"username": "ana.rrhh", "email": "ana@inespasa.test", "first": "Ana", "last": "López", "role": "rrhh", "dept": "RRHH", "pos": "Director RRHH", "manager": "juan.ceo"},
            {"username": "carlos.ops", "email": "carlos@inespasa.test", "first": "Carlos", "last": "Sánchez", "role": "empleado", "dept": "Operaciones", "pos": "Director Operaciones", "manager": "juan.ceo"},
            
            # Managers
            {"username": "marta.it", "email": "marta@inespasa.test", "first": "Marta", "last": "Rodríguez", "role": "empleado", "dept": "IT", "pos": "IT Manager", "manager": "carlos.ops"},
            {"username": "pedro.ventas", "email": "pedro@inespasa.test", "first": "Pedro", "last": "Gómez", "role": "empleado", "dept": "Ventas", "pos": "Ventas Manager", "manager": "juan.ceo"},
            {"username": "elena.mkt", "email": "elena@inespasa.test", "first": "Elena", "last": "Fernández", "role": "empleado", "dept": "Marketing", "pos": "Mkt Manager", "manager": "juan.ceo"},
            {"username": "javier.log", "email": "javier@inespasa.test", "first": "Javier", "last": "Martín", "role": "empleado", "dept": "Logística", "pos": "Logística Manager", "manager": "carlos.ops"},

            # Employees
            {"username": "david.it", "email": "david@inespasa.test", "first": "David", "last": "Ruiz", "role": "empleado", "dept": "IT", "pos": "Desarrollador Senior", "manager": "marta.it"},
            {"username": "lucia.it", "email": "lucia@inespasa.test", "first": "Lucia", "last": "Díaz", "role": "empleado", "dept": "IT", "pos": "Desarrollador Senior", "manager": "marta.it"},
            {"username": "sofia.rrhh", "email": "sofia@inespasa.test", "first": "Sofia", "last": "Moreno", "role": "empleado", "dept": "RRHH", "pos": "Especialista RRHH", "manager": "ana.rrhh"},
            {"username": "sergio.v", "email": "sergio@inespasa.test", "first": "Sergio", "last": "Álvarez", "role": "empleado", "dept": "Ventas", "pos": "Comercial", "manager": "pedro.ventas"},
            {"username": "laura.v", "email": "laura@inespasa.test", "first": "Laura", "last": "Jiménez", "role": "empleado", "dept": "Ventas", "pos": "Comercial", "manager": "pedro.ventas"},
            {"username": "paco.op", "email": "paco@inespasa.test", "first": "Paco", "last": "Herrera", "role": "empleado", "dept": "Operaciones", "pos": "Operario", "manager": "carlos.ops"},
            {"username": "maria.log", "email": "maria@inespasa.test", "first": "Maria", "last": "Castro", "role": "empleado", "dept": "Logística", "pos": "Operario", "manager": "javier.log"},
            {"username": "antonio.it", "email": "antonio@inespasa.test", "first": "Antonio", "last": "Blanco", "role": "empleado", "dept": "IT", "pos": "Desarrollador Senior", "manager": "marta.it"},
            {"username": "rocio.v", "email": "rocio@inespasa.test", "first": "Rocio", "last": "Molina", "role": "empleado", "dept": "Ventas", "pos": "Comercial", "manager": "pedro.ventas"},
            {"username": "dani.mkt", "email": "dani@inespasa.test", "first": "Daniel", "last": "Serrano", "role": "empleado", "dept": "Marketing", "pos": "Comercial", "manager": "elena.mkt"},
            {"username": "irene.it", "email": "irene@inespasa.test", "first": "Irene", "last": "Delgado", "role": "empleado", "dept": "IT", "pos": "Desarrollador Senior", "manager": "marta.it"},
            {"username": "jose.op", "email": "jose@inespasa.test", "first": "Jose", "last": "Pérez", "role": "empleado", "dept": "Operaciones", "pos": "Operario", "manager": "carlos.ops"},
            {"username": "carmen.rrhh", "email": "carmen@inespasa.test", "first": "Carmen", "last": "Torres", "role": "empleado", "dept": "RRHH", "pos": "Especialista RRHH", "manager": "ana.rrhh"},
        ]

        # 4. Create Users
        password_hash = get_password_hash("inespasa2026") # Default password for all test users
        users_map = {}
        for ud in users_data:
            stmt = select(User).where(User.username == ud["username"])
            res = await session.execute(stmt)
            u = res.scalar_one_or_none()
            if not u:
                u = User(
                    username=ud["username"],
                    email=ud["email"],
                    password_hash=password_hash,
                    first_name=ud["first"],
                    last_name=ud["last"],
                    role=ud["role"],
                    department_uuid=depts[ud["dept"]].id,
                    position_uuid=positions[ud["pos"]].id,
                    vac_days=22.0
                )
                session.add(u)
                await session.flush()
                logger.info(f"Created user: {ud['username']}")
            users_map[ud["username"]] = u

        # 5. Establish Manager Links and RRHH Responsibles
        # Find some RRHH users to assign as default RRHH responsibles
        stmt = select(User).where(User.role == "rrhh")
        res = await session.execute(stmt)
        rrhh_users = res.scalars().all()
        
        main_rrhh = users_map.get("ana.rrhh")
        
        for ud in users_data:
            user = users_map[ud["username"]]
            
            # Manager link
            if "manager" in ud:
                manager = users_map.get(ud["manager"])
                if manager:
                    # Check if link exists
                    stmt_link = select(UserManagerLink).where(
                        UserManagerLink.user_id == user.id,
                        UserManagerLink.manager_id == manager.id
                    )
                    res_link = await session.execute(stmt_link)
                    if not res_link.scalar_one_or_none():
                        session.add(UserManagerLink(user_id=user.id, manager_id=manager.id))
            
            # RRHH link (Auto assign Ana Lopez as RRHH responsible for everyone except herself/direct HR)
            if main_rrhh and user.id != main_rrhh.id:
                 stmt_rh = select(UserRrhhLink).where(
                     UserRrhhLink.user_id == user.id,
                     UserRrhhLink.rrhh_id == main_rrhh.id
                 )
                 res_rh = await session.execute(stmt_rh)
                 if not res_rh.scalar_one_or_none():
                     session.add(UserRrhhLink(user_id=user.id, rrhh_id=main_rrhh.id))

        await session.commit()
        logger.info("Test hierarchy seeded successfully with 20 users.")

    except Exception as e:
        logger.error(f"Error seeding test hierarchy: {e}")
        import traceback
        traceback.print_exc()
