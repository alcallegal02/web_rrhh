import asyncio
from sqlalchemy import text
from app.database import get_pg_connection

async def cleanup_db():
    print("Connecting to database...")
    conn = await get_pg_connection()
    try:
        print("dropping legacy tables...")
        await conn.execute("DROP TABLE IF EXISTS user_balances CASCADE")
        await conn.execute("DROP TABLE IF EXISTS convenio_rules CASCADE")
        await conn.execute("DROP TABLE IF EXISTS absence_types CASCADE")
        
        print("Altering convenio_config table...")
        columns_to_drop = [
            "vacation_days_annual",
            "personal_days_hours",
            "compensated_days_hours",
            "medical_general_hours",
            "medical_specialist_hours",
            "paid_leave_hours",
            "extra_hours_pool",
            "union_hours",
            "annual_work_hours"
        ]
        
        for col in columns_to_drop:
            try:
                # Check if column exists before dropping to avoid errors
                check = await conn.fetchval(
                    "SELECT 1 FROM information_schema.columns WHERE table_name='convenio_config' AND column_name=$1",
                    col
                )
                if check:
                    print(f"Dropping column {col}...")
                    await conn.execute(f"ALTER TABLE convenio_config DROP COLUMN {col}")
                else:
                    print(f"Column {col} already missing.")
            except Exception as e:
                print(f"Error dropping {col}: {e}")

        print("Cleanup complete.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(cleanup_db())
