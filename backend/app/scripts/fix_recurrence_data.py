import asyncio

import asyncpg


async def fix_data():
    dsn = "postgresql://web_rrhh_user:dev_postgres_password@postgres:5432/web_rrhh_dev"
    print("Connecting to DB...")
    conn = await asyncpg.connect(dsn)
    
    # helper
    async def update(slug, reset_type, max_days=0.0, max_uses=None, val_win=0, val_unit='months', accum=False):
        print(f"Updating {slug}...")
        await conn.execute(f"""
            UPDATE permission_policies 
            SET reset_type = '{reset_type}',
                max_days_per_period = {max_days},
                max_usos_por_periodo = {max_uses if max_uses else 'NULL'},
                validity_window_value = {val_win},
                validity_window_unit = '{val_unit}',
                is_accumulable = {'TRUE' if accum else 'FALSE'}
            WHERE slug = '{slug}'
        """)

    try:
        # 1. Calendario
        await update("vacaciones", "anual_calendario", max_days=22)
        await update("fuerza-mayor", "anual_calendario", max_days=4)
        await update("permiso-climatico", "anual_calendario", max_days=4)
        await update("asuntos-propios", "anual_calendario", max_days=2) # as per seeder
        await update("formacion", "anual_calendario", max_days=2.5, accum=True) # 20h

        # 2. Por Evento
        event_slugs = ["matrimonio", "enfermedad-grave", "fallecimiento", "mudanza", 
                       "deber-inexcusable", "examenes", "prenatal", "busqueda-empleo", 
                       "donacion", "riesgo-embarazo", "it-baja", "excedencia-voluntaria", 
                       "teletrabajo-formacion"]
        for s in event_slugs:
            await update(s, "por_evento")
            
        # Specific fixes
        await update("matrimonio", "por_evento", val_win=1) 
        
        # 3. Relativo
        await update("lactancia", "anual_relativo", max_days=15, val_win=9)
        await update("nacimiento", "anual_relativo", val_win=12) # 19 weeks is duration check, not quota? Quota is 1 event? Actually reset_type RELATIVE implies 1 year cycle?
        # User said: "ANUAL_RELATIVO: El contador de 1 año empieza desde la primera solicitud (ej: Paternidad/Maternidad)"
        # Note: Maternity is usually 1 event per child. But if relative year logic, it prevents second maternity in same year?
        # Actually, "ResetType" for Maternity might be "PER_EVENT" (Each birth is new).
        # But User SPECIFICALLY cited "Paternidad/Maternidad" as example for ANUAL_RELATIVO.
        # So I will follow user instruction.
        
        # 4. Sin Reinicio
        await update("parental-8-semanas", "sin_reinicio", val_win=96)

        print("Data fix complete.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_data())
