"""merge_plaid_heads

Revision ID: 0e5d999b6cc3
Revises: 43ee040327ae, add_household_plaid_sandbox
Create Date: 2026-06-03 16:38:47.487176

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e5d999b6cc3'
down_revision: Union[str, Sequence[str], None] = ('43ee040327ae', 'add_household_plaid_sandbox')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
