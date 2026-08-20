from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.cedis_file import CedisFile


def get_active_cedis_file(
    db: Session,
) -> CedisFile | None:
    statement = (
        select(CedisFile)
        .where(CedisFile.is_active.is_(True))
        .order_by(CedisFile.uploaded_at.desc())
        .limit(1)
    )

    return db.scalar(statement)


def get_cedis_file_by_id(
    db: Session,
    file_id: int,
) -> CedisFile | None:
    return db.get(
        CedisFile,
        file_id,
    )


def get_cedis_history(
    db: Session,
) -> list[CedisFile]:
    statement = (
        select(CedisFile)
        .order_by(
            CedisFile.uploaded_at.desc(),
            CedisFile.id.desc(),
        )
    )

    return list(
        db.scalars(statement).all()
    )


def deactivate_all_cedis_files(
    db: Session,
) -> None:
    statement = (
        update(CedisFile)
        .where(CedisFile.is_active.is_(True))
        .values(is_active=False)
    )

    db.execute(statement)


def create_cedis_file(
    db: Session,
    *,
    original_filename: str,
    stored_filename: str,
    mime_type: str | None,
    file_size: int,
    file_path: str,
    uploaded_by_id: int | None = None,
) -> CedisFile:
    try:
        # A nova versão só passa a ativa dentro
        # da mesma transação que desativa a anterior.
        deactivate_all_cedis_files(db)

        cedis_file = CedisFile(
            original_filename=original_filename,
            stored_filename=stored_filename,
            mime_type=mime_type,
            file_size=file_size,
            file_path=file_path,
            is_active=True,
            uploaded_by_id=uploaded_by_id,
        )

        db.add(cedis_file)

        db.commit()

        db.refresh(cedis_file)

        return cedis_file

    except Exception:
        db.rollback()
        raise