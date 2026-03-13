"""add user permissions and notifications

Revision ID: e7b2a6f8c9d0
Revises: f794d554c1f9
Create Date: 2026-03-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7b2a6f8c9d0'
down_revision: Union[str, None] = 'f794d554c1f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('can_manage_complaints', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('users', sa.Column('notif_own_requests', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('notif_managed_requests', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('notif_complaints', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    op.drop_column('users', 'notif_complaints')
    op.drop_column('users', 'notif_managed_requests')
    op.drop_column('users', 'notif_own_requests')
    op.drop_column('users', 'can_manage_complaints')
