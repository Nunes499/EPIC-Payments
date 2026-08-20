from datetime import datetime

from pydantic import BaseModel


class CedisFileRead(BaseModel):
    id: int

    original_filename: str
    stored_filename: str

    mime_type: str | None = None
    file_size: int | None = None

    file_path: str

    is_active: bool

    uploaded_by_id: int | None = None
    uploaded_at: datetime

    model_config = {
        "from_attributes": True,
    }


class CedisPreviewRow(BaseModel):
    member_number: str | None = None
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    birth_year: int | None = None
    age: int | None = None


class CedisPreviewResponse(BaseModel):
    file: CedisFileRead

    total_rows: int
    preview_rows: list[CedisPreviewRow]

    columns: list[str]