import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlmodel import select
from app.models.policy import PermissionPolicy, PolicyResetType

async def check():
    dsn = 'postgresql+asyncpg://web_rrhh_user:dev_postgres_password@postgres:5432/web_rrhh_dev'
    engine = create_async_engine(dsn)
    async with AsyncSession(engine) as session:
        res = await session.execute(select(PermissionPolicy).where(PermissionPolicy.slug == 'fallecimiento'))
        p = res.scalar_one_or_none()
        if p:
            print(f"SLUG: {p.slug}")
            print(f"RESET_TYPE: {p.reset_type}")
            
            # If not POR_EVENTO, fix it
            if p.reset_type != PolicyResetType.POR_EVENTO:
                print("Fixing to POR_EVENTO...")
                p.reset_type = PolicyResetType.POR_EVENTO
                session.add(p)
                await session.commit()
                print("Fixed.")
        else:
            print("Not found")

if __name__ == "__main__":
    asyncio.run(check())
