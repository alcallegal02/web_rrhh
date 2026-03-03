import asyncio
import asyncpg

async def migrate_v2():
    # Hardcoded URL for Docker internal network - assumes service name is 'postgres'
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

        await add_col("allow_split", "BOOLEAN", "FALSE")
        await add_col("mandatory_immediate_duration", "FLOAT", "0.0")
        await add_col("split_min_duration", "FLOAT", "0.0")
        await add_col("validity_months", "INTEGER", "0")

        # 2026 Columns
        await add_col("max_days_per_year", "FLOAT", "0.0")
        await add_col("accumulable_years", "INTEGER", "0")
        await add_col("travel_extension_days", "FLOAT", "0.0")
        await add_col("requires_document_type", "VARCHAR", "NULL") # Nullable string

        # Update existing data to match new defaults
        print("Updating existing policies...")
        # Check if table has data first to avoid errors if empty
        try:
             await conn.execute("UPDATE permission_policies SET travel_extension_days=2.0 WHERE slug='fallecimiento'")
             await conn.execute("UPDATE permission_policies SET description='2 días (4 con viaje). Familiares hasta 2º grado.' WHERE slug='fallecimiento'")
        except Exception as e:
             print(f"Data update warning: {e}")

        print("Migration V2.1 + Data Update complete.")
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_v2())
