import asyncio
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL)

async def inspect():
    async with engine.connect() as conn:
        print("--- Table Info: permission_policies ---")
        try:
            res = await conn.execute(text("SELECT * FROM permission_policies"))
            rows = res.fetchall()
            print(f"Count: {len(rows)}")
            for r in rows:
                print(r)
        except Exception as e:
            print(f"Error reading policies: {e}")

        print("\n--- Columns: vacation_requests ---")
        try:
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='vacation_requests'"))
            for r in res.fetchall():
                print(r[0])
        except Exception as e:
            print(e)
            
if __name__ == "__main__":
    asyncio.run(inspect())
