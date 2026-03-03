#!/usr/bin/env python3
"""
Script para crear el usuario administrador inicial
"""
import sys
import os
import asyncio
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select
import asyncpg

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

async def create_admin_user():
    """Create admin user with proper password hash from environment variables"""
    
    # Get admin user credentials from environment variables
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    admin_full_name = os.getenv("ADMIN_FULL_NAME", "Admin RRHH")
    admin_role = os.getenv("ADMIN_ROLE", "rrhh")
    
    if not admin_email or not admin_password:
        print("Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables")
        print("Please set these variables in your .env.dev or .env.prod file")
        return
    
    # Get database URL from environment
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("Error: DATABASE_URL must be set in environment variables")
        return
    
    # Parse connection details
    db_url_clean = db_url.replace("postgresql+asyncpg://", "")
    parts = db_url_clean.split("@")
    
    if len(parts) != 2:
        print("Error: Invalid DATABASE_URL format")
        return
    
    user_pass = parts[0].split(":")
    host_db = parts[1].split("/")
    host_port = host_db[0].split(":")
    
    db_user = user_pass[0]
    db_password = user_pass[1] if len(user_pass) > 1 else ""
    db_host = host_port[0]
    db_port = int(host_port[1]) if len(host_port) > 1 else 5432
    db_name = host_db[1] if len(host_db) > 1 else "web_rrhh_dev"
    
    # Connect to database
    try:
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        
        # Hash password
        password_hash = pwd_context.hash(admin_password)
        
        # Check if user exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1",
            admin_email
        )
        
        if existing:
            # Update existing user
            await conn.execute(
                """
                UPDATE users 
                SET password_hash = $1, full_name = $2, role = $3::user_role, is_active = TRUE
                WHERE email = $4
                """,
                password_hash, admin_full_name, admin_role, admin_email
            )
            print(f"✓ Usuario {admin_email} actualizado correctamente")
        else:
            # Create new user
            await conn.execute(
                """
                INSERT INTO users (email, password_hash, full_name, role, is_active)
                VALUES ($1, $2, $3, $4::user_role, TRUE)
                """,
                admin_email, password_hash, admin_full_name, admin_role
            )
            print(f"✓ Usuario {admin_email} creado correctamente")
        
        await conn.close()
        print(f"\nUsuario administrador configurado:")
        print(f"  Email: {admin_email}")
        print(f"  Nombre: {admin_full_name}")
        print(f"  Rol: {admin_role}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_admin_user())

