"""Add onboarding fields to distillery

Revision ID: 004
Revises: 003
Create Date: 2024-04-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Add onboarding step 4 fields to distilleries
    op.add_column('distilleries', sa.Column('water_profile_id', sa.String(50), nullable=True, server_default='neutral'))
    op.add_column('distilleries', sa.Column('starter_pack', sa.String(50), nullable=True, server_default='none'))


def downgrade():
    op.drop_column('distilleries', 'starter_pack')
    op.drop_column('distilleries', 'water_profile_id')
