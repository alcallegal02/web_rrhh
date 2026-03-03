import asyncio
import uuid
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

DATABASE_URL = settings.DATABASE_URL
engine = create_async_engine(DATABASE_URL, echo=False)

async def migrate():
    print("Starting FORCE migration...")
    
    # 1. Clean Slate (Separate transaction to ensure drops are committed before creates)
    async with engine.begin() as conn:
        print("Dropping existing structures...")
        await conn.execute(text("DROP TABLE IF EXISTS permission_policies CASCADE"))
        # We also drop the column to ensure type matches and no old data conflicts (ids will change)
        await conn.execute(text("ALTER TABLE vacation_requests DROP COLUMN IF EXISTS policy_id"))
        print("Dropped.")

    # 2. Recreate Schema
    async with engine.begin() as conn:
        print("Creating table...")
        await conn.execute(text("""
            CREATE TABLE permission_policies (
                id UUID PRIMARY KEY,
                slug VARCHAR UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                description VARCHAR,
                duration_value FLOAT NOT NULL,
                duration_unit VARCHAR NOT NULL,
                is_paid BOOLEAN NOT NULL DEFAULT TRUE,
                requires_justification BOOLEAN NOT NULL DEFAULT FALSE,
                modality VARCHAR DEFAULT 'presencial_ausente',
                limit_age_child INTEGER,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
                color VARCHAR,
                icon VARCHAR,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )
        """))
        
        print("Adding FK column...")
        await conn.execute(text("""
            ALTER TABLE vacation_requests 
            ADD COLUMN policy_id UUID REFERENCES permission_policies(id)
        """))

    # 3. Insert Policies
    policies = [
        ("vacaciones", "Vacaciones", 22, "days_work", False, True, True),
        ("asuntos_propios", "Asuntos Propios", 2, "days_work", False, True, True),
        ("dias_compensados", "Días Compensados", 0, "days_work", False, True, True),
        ("medico_general", "Médico General", 16, "hours", True, True, True),
        ("medico_especialista", "Médico Especialista", 1, "days_work", True, True, True),
        ("licencia_retribuida", "Licencia Retribuida", 0, "days_work", True, True, True),
        ("bolsa_horas", "Bolsa de Horas", 0, "hours", False, True, True),
        ("horas_sindicales", "Horas Sindicales", 0, "hours", True, True, True),
        ("maternidad_paternidad", "Maternidad / Paternidad", 16, "weeks", True, False, True),
        ("baja_enfermedad", "Baja por Enfermedad", 365, "days_natural", True, False, False),
        ("baja_accidente", "Baja Accidente", 365, "days_natural", True, False, False),
        ("absentismo_no_retribuido", "Absentismo No Retribuido", 0, "days_work", False, False, False),
        ("licencia_no_retribuida", "Licencia No Retribuida", 0, "days_work", False, False, False),
        ("enfermo_en_casa", "Enfermo en Casa", 3, "days_natural", False, True, True),
        ("permisos", "Permisos", 0, "days_work", True, True, True),
        ("teletrabajo", "Teletrabajo", 0, "days_work", False, True, False),
        ("visita_clientes", "Visita Clientes", 0, "days_work", False, True, True),
    ]

    async with engine.begin() as conn:
        print("Inserting policies...")
        policy_map = {}
        for slug, name, dur, unit, justif, paid, default in policies:
            new_id = uuid.uuid4()
            await conn.execute(text("""
                INSERT INTO permission_policies (id, slug, name, duration_value, duration_unit, is_paid, requires_justification, is_system_default, is_active, created_at, updated_at)
                VALUES (:id, :slug, :name, :dur, :unit, :paid, :justif, :default, TRUE, NOW(), NOW())
            """), {
                "id": new_id, "slug": slug, "name": name, "dur": dur, "unit": unit, 
                "paid": paid, "justif": justif, "default": default
            })
            policy_map[slug] = new_id

        # 4. Migrate Data
        print("Migrating requests...")
        for slug, pid in policy_map.items():
            await conn.execute(text("""
                UPDATE vacation_requests 
                SET policy_id = :pid 
                WHERE request_type = :slug AND policy_id IS NULL
            """), {"pid": pid, "slug": slug})
            
    print("Migration successful.")

if __name__ == "__main__":
    asyncio.run(migrate())
