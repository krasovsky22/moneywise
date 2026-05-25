from pydantic import BaseModel


class AppBaseModel(BaseModel):
    """Base Pydantic model with shared configuration."""

    model_config = {
        "from_attributes": True,  # Allow ORM model → Pydantic conversion
        "populate_by_name": True,
    }
