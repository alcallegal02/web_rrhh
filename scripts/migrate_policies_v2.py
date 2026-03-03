import asyncio
from app.database import get_pg_connection

async def migrate_v2():
    print("Connecting to database...")
    conn = await get_pg_connection()
    try:
        print("Altering permission_policies table...")
        
        # Helper to add column if not exists
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
        
        print("Migration V2 complete.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate_v2())
