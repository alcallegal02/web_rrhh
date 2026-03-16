"""add notif_news to user

Revision ID: fdc79bbfb713
Revises: e7b2a6f8c9d0
Create Date: 2026-03-16 07:11:05.577396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdc79bbfb713'
down_revision: Union[str, None] = 'e7b2a6f8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('notif_news', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    op.drop_column('users', 'notif_news')
