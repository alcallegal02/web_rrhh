import asyncio
import asyncpg

async def migrate_recurrence():
    dsn = "postgresql://web_rrhh_user:dev_postgres_password@postgres:5432/web_rrhh_dev"
    print(f"Connecting to DB...")
    try:
        conn = await asyncpg.connect(dsn)
        print("Connected.")
        
        async def add_col(name, type_def, default):
            check = await conn.fetchval(
                "SELECT 1 FROM information_schema.columns WHERE table_name='permission_policies' AND column_name=$1",
                name
            )
            if not check:
                print(f"Adding column {name}...")
                await conn.execute(f"ALTER TABLE permission_policies ADD COLUMN {name} {type_def} DEFAULT {default}")
            else:
                print(f"Column {name} exists.")

        # Recurrence Fields
        await add_col("reset_type", "VARCHAR", "'anual_calendario'")
        await add_col("max_usos_por_periodo", "INTEGER", "NULL")
        await add_col("max_days_per_period", "FLOAT", "0.0")
        await add_col("validity_window_value", "INTEGER", "0")
        await add_col("validity_window_unit", "VARCHAR", "'months'")
        await add_col("is_accumulable", "BOOLEAN", "FALSE")
        
        # We try to rename old columns if they exist to preserve data, or just ignore
        # max_days_per_year -> max_days_per_period (Copy data if 0)
        # But for now, let's just leave old columns and ensure code uses new ones.
        
        print("Migration Recurrence complete.")
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_recurrence())
