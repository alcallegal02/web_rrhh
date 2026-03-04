import asyncio

import asyncpg


async def migrate_visibility():
    dsn = "postgresql://web_rrhh_user:dev_postgres_password@postgres:5432/web_rrhh_dev"
    print("Connecting to DB...")
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

        await add_col("is_public_dashboard", "BOOLEAN", "FALSE")
        
        # Set default 'TRUE' for standard policies (Vacaciones, Asuntos Propios)
        print("Setting defaults for specific policies...")
        await conn.execute("UPDATE permission_policies SET is_public_dashboard = TRUE WHERE slug IN ('vacaciones', 'asuntos-propios', 'fuerza-mayor')")

        print("Migration Dashboard Visibility complete.")
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_visibility())
