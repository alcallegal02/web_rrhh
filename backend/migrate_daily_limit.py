import asyncio
import asyncpg
import os

async def migrate():
    # Use environment variables if available, otherwise fallback to known defaults
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        dsn = "postgresql://web_rrhh_user:dev_postgres_password@postgres:5432/web_rrhh_dev"
    
    # asyncpg expects the driver name at the start, but DATABASE_URL might have postgresql+asyncpg
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    
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

        await add_col("max_duration_per_day", "FLOAT", "NULL")

        print("Migration complete.")
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
