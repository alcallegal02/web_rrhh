"""add_advanced_absence_constraints

Revision ID: 3e34bf337d47
Revises: c435c0771dbc
Create Date: 2026-04-13 09:18:32.476435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.

revision: str = '3e34bf337d47'
down_revision: Union[str, None] = 'c435c0771dbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Añadir nuevos campos de casuísticas avanzadas a permission_policies
    op.add_column('permission_policies', sa.Column('min_seniority_months', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('permission_policies', sa.Column('max_days_from_event', sa.Integer(), nullable=True))
    op.add_column('permission_policies', sa.Column('justification_deadline_days', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('permission_policies', sa.Column('attachment_type_label', sa.String(), nullable=True))
    op.add_column('permission_policies', sa.Column('mandatory_request_fields', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('permission_policies', 'mandatory_request_fields')
    op.drop_column('permission_policies', 'attachment_type_label')
    op.drop_column('permission_policies', 'justification_deadline_days')
    op.drop_column('permission_policies', 'max_days_from_event')
    op.drop_column('permission_policies', 'min_seniority_months')
