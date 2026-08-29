from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from difflib import SequenceMatcher
import hashlib
import re
import unicodedata
import xml.etree.ElementTree as ET

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.calendar_file import get_files_between_dates
from app.services.bank_reason_codes import get_reason_description
from app.services.calendar_service import (
    extract_pdf_metadata,
    extract_pdf_rows,
    get_calendar_file_contents,
)
from app.services.d1_service import execute_d1_query, get_d1_rows

MAX_SEARCH_MONTHS = 36
MAX_CANDIDATES = 3
ALLOWED_HISTORY_MONTHS = {3, 6, 12, 24, 36}


def _subtract_months(value: date, months: int) -> date:
    total = value.year * 12 + value.month - 1 - months
    year = total // 12
    month = total % 12 + 1
    leap = year % 400 == 0 or (year % 4 == 0 and year % 100 != 0)
    lengths = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(value.day, lengths[month - 1]))


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c)).upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", value).split())


def _normalize_reference(value: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def _looks_numeric_search(value: str) -> bool:
    return bool(re.fullmatch(r"\d+", value or ""))


def _parse_iso_date(value: str | None, fallback: date) -> date:
    try:
        return date.fromisoformat((value or "")[:10])
    except ValueError:
        return fallback


def _parse_pt_date(value: str | None, fallback: date) -> date:
    match = re.fullmatch(r"(\d{2})-(\d{2})-(\d{4})", (value or "").strip())
    if not match:
        return fallback
    day, month, year = match.groups()
    try:
        return date(int(year), int(month), int(day))
    except ValueError:
        return fallback


# =========================================================
# ÍNDICE D1
# =========================================================


def ensure_bank_index_schema() -> None:
    execute_d1_query(
        """
        CREATE TABLE IF NOT EXISTS bank_index_files (
            file_id INTEGER PRIMARY KEY,
            calendar_date TEXT NOT NULL,
            document_date TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            stored_category TEXT NOT NULL,
            inferred_role TEXT NOT NULL,
            logical_batch_id TEXT,
            message_id TEXT,
            original_message_id TEXT,
            declared_transactions INTEGER,
            parsed_transactions INTEGER NOT NULL DEFAULT 0,
            recovery_part INTEGER,
            related_file_id INTEGER,
            indexed_at TEXT NOT NULL,
            index_error TEXT
        )
        """
    )
    execute_d1_query(
        """
        CREATE TABLE IF NOT EXISTS bank_index_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            document_date TEXT NOT NULL,
            movement_date TEXT NOT NULL,
            logical_batch_id TEXT,
            inferred_role TEXT NOT NULL,
            member_reference TEXT NOT NULL,
            member_reference_norm TEXT NOT NULL,
            holder_name TEXT NOT NULL,
            holder_name_norm TEXT NOT NULL,
            iban TEXT,
            amount TEXT NOT NULL,
            reason_code TEXT NOT NULL,
            reason_description TEXT NOT NULL,
            collection_reference TEXT,
            bank_service_reference TEXT,
            sequence_no INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    for sql in (
        "CREATE INDEX IF NOT EXISTS idx_bim_ref ON bank_index_movements(member_reference_norm)",
        "CREATE INDEX IF NOT EXISTS idx_bim_name ON bank_index_movements(holder_name_norm)",
        "CREATE INDEX IF NOT EXISTS idx_bim_date ON bank_index_movements(document_date)",
        "CREATE INDEX IF NOT EXISTS idx_bim_batch ON bank_index_movements(logical_batch_id, collection_reference)",
        "CREATE INDEX IF NOT EXISTS idx_bim_file ON bank_index_movements(file_id)",
    ):
        execute_d1_query(sql)


def _is_recovery_batch(batch_id: str | None) -> bool:
    return "DEV" in _normalize_text(batch_id).split()


def _infer_role(*, stored_category: str, recovery_part: int | None, batch_id: str | None, later_return: bool) -> str:
    if stored_category == "recovery":
        return "recovery_return" if recovery_part == 2 else "recovery_initial"
    if stored_category == "returned":
        return "returned"
    if _is_recovery_batch(batch_id):
        return "recovery_return" if later_return else "recovery_initial"
    return "returned" if later_return else "normal"


# =========================================================
# PDF — leitura bancária sem CEDIS
# =========================================================


def _search_pdf_text(full_text: str, pattern: str) -> str | None:
    match = re.search(pattern, full_text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def _parse_pdf_for_index(calendar_file) -> dict:
    rows, full_text = extract_pdf_rows(get_calendar_file_contents(calendar_file))
    metadata = extract_pdf_metadata(full_text)

    report_date = _search_pdf_text(
        full_text,
        r"Data\s+de\s+Emiss[aã]o\s+do\s+Relat[oó]rio\s*:\s*(\d{2}-\d{2}-\d{4})",
    )
    return_type = _search_pdf_text(full_text, r"Tipo\s+de\s+Retorno\s*:\s*([^\n\r]+)")

    document_date = _parse_pt_date(report_date, calendar_file.calendar_date)
    batch_id = str(metadata.get("file_identifier") or "").strip()
    declared = metadata.get("declared_transactions")
    parsed = len(rows)
    normalized_type = _normalize_text(return_type)
    later_return = "DEVOLUCOES" in normalized_type or "REEMBOLSOS" in normalized_type
    if not later_return and declared is not None and parsed < declared and "REJEICOES" not in normalized_type:
        later_return = True

    role = _infer_role(
        stored_category=calendar_file.file_category or "normal",
        recovery_part=calendar_file.recovery_part,
        batch_id=batch_id,
        later_return=later_return,
    )

    collection_date = metadata.get("collection_date") or document_date
    movements = []
    for sequence, row in enumerate(rows, start=1):
        movements.append(
            {
                "sequence_no": sequence,
                "member_reference": str(row.get("original_member_reference") or "").strip(),
                "holder_name": str(row.get("name") or "").strip(),
                "iban": str(row.get("iban")).strip() if row.get("iban") else None,
                "amount": Decimal(str(row.get("amount") or "0")),
                "reason_code": str(row.get("reason_code") or "").strip().upper(),
                "reason_description": str(row.get("reason_description") or "").strip(),
                "movement_date": collection_date,
                "collection_reference": str(row.get("bank_reference")).strip() if row.get("bank_reference") is not None else None,
                "bank_service_reference": None,
            }
        )

    return {
        "document_date": document_date,
        "logical_batch_id": batch_id,
        "message_id": batch_id or None,
        "original_message_id": None,
        "declared_transactions": declared,
        "parsed_transactions": parsed,
        "inferred_role": role,
        "movements": movements,
    }


# =========================================================
# XML — OrgnlEndToEndId = Referência da Cobrança
# =========================================================


def _xml_ns(root: ET.Element) -> str:
    match = re.match(r"^\{(.+)\}", root.tag)
    return match.group(1) if match else ""


def _xtag(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}" if ns else name


def _xtext(element: ET.Element | None, ns: str, path: list[str]) -> str | None:
    if element is None:
        return None
    current = element
    for name in path:
        current = current.find(_xtag(ns, name))
        if current is None:
            return None
    return current.text.strip() if current.text else None


def _parse_xml_for_index(calendar_file) -> dict:
    try:
        root = ET.fromstring(get_calendar_file_contents(calendar_file))
    except ET.ParseError as exc:
        raise HTTPException(status_code=400, detail=f"Não foi possível interpretar o XML {calendar_file.original_filename}.") from exc

    ns = _xml_ns(root)
    report = root.find(_xtag(ns, "CstmrPmtStsRpt"))
    if report is None:
        raise HTTPException(status_code=400, detail="O XML não contém CstmrPmtStsRpt.")

    header = report.find(_xtag(ns, "GrpHdr"))
    message_id = _xtext(header, ns, ["MsgId"])
    document_date = _parse_iso_date(_xtext(header, ns, ["CreDtTm"]), calendar_file.calendar_date)

    original_group = report.find(_xtag(ns, "OrgnlGrpInfAndSts"))
    original_message_id = _xtext(original_group, ns, ["OrgnlMsgId"])
    batch_id = (original_message_id or "").strip()
    declared_text = _xtext(original_group, ns, ["OrgnlNbOfTxs"])
    try:
        declared = int(declared_text) if declared_text else None
    except ValueError:
        declared = None
    group_status = (_xtext(original_group, ns, ["StsRsnInf", "Rsn", "Prtry"]) or "").upper()

    movements = []
    payment_statuses = []
    sequence = 0
    for payment_group in report.findall(_xtag(ns, "OrgnlPmtInfAndSts")):
        pstatus = (_xtext(payment_group, ns, ["StsRsnInf", "Rsn", "Prtry"]) or "").upper()
        if pstatus:
            payment_statuses.append(pstatus)

        for tx in payment_group.findall(_xtag(ns, "TxInfAndSts")):
            sequence += 1
            reason_code = (
                _xtext(tx, ns, ["StsRsnInf", "Rsn", "Cd"])
                or _xtext(tx, ns, ["StsRsnInf", "Rsn", "Prtry"])
                or ""
            ).upper()
            collection_ref = _xtext(tx, ns, ["OrgnlEndToEndId"])
            bank_service_ref = _xtext(tx, ns, ["AcctSvcrRef"])
            original_tx = tx.find(_xtag(ns, "OrgnlTxRef"))
            if original_tx is None:
                continue

            amount_text = _xtext(original_tx, ns, ["Amt", "InstdAmt"])
            try:
                amount = Decimal(amount_text or "0")
            except Exception:
                amount = Decimal("0")

            movement_date = _parse_iso_date(_xtext(original_tx, ns, ["ReqdColltnDt"]), document_date)
            member_reference = (_xtext(original_tx, ns, ["MndtRltdInf", "MndtId"]) or "").strip()
            holder_name = (_xtext(original_tx, ns, ["Dbtr", "Pty", "Nm"]) or "").strip()
            iban = _xtext(original_tx, ns, ["DbtrAcct", "Id", "IBAN"])

            movements.append(
                {
                    "sequence_no": sequence,
                    "member_reference": member_reference,
                    "holder_name": holder_name,
                    "iban": iban,
                    "amount": amount,
                    "reason_code": reason_code,
                    "reason_description": get_reason_description(reason_code),
                    "movement_date": movement_date,
                    "collection_reference": collection_ref.strip() if collection_ref else None,
                    "bank_service_reference": bank_service_ref.strip() if bank_service_ref else None,
                }
            )

    parsed = len(movements)
    later_return = group_status == "M009" or "L002" in payment_statuses
    if not later_return and declared is not None and parsed < declared:
        later_return = True

    role = _infer_role(
        stored_category=calendar_file.file_category or "normal",
        recovery_part=calendar_file.recovery_part,
        batch_id=batch_id,
        later_return=later_return,
    )

    return {
        "document_date": document_date,
        "logical_batch_id": batch_id,
        "message_id": message_id,
        "original_message_id": original_message_id,
        "declared_transactions": declared,
        "parsed_transactions": parsed,
        "inferred_role": role,
        "movements": movements,
    }


def _parse_file_for_index(calendar_file) -> dict:
    if calendar_file.file_type == "pdf":
        return _parse_pdf_for_index(calendar_file)
    if calendar_file.file_type == "xml":
        return _parse_xml_for_index(calendar_file)
    raise HTTPException(status_code=400, detail="Formato não suportado pela Pesquisa Bancária.")


# =========================================================
# GRAVAÇÃO / SINCRONIZAÇÃO DO ÍNDICE
# =========================================================


def _delete_index_for_file(file_id: int) -> None:
    execute_d1_query("DELETE FROM bank_index_movements WHERE file_id = ?", [file_id])
    execute_d1_query("DELETE FROM bank_index_files WHERE file_id = ?", [file_id])


def _insert_movements(file_id: int, parsed: dict) -> None:
    movements = parsed["movements"]
    if not movements:
        return

    chunk_size = 4
    columns = 16
    for start in range(0, len(movements), chunk_size):
        chunk = movements[start : start + chunk_size]
        placeholders = ", ".join("(" + ", ".join(["?"] * columns) + ")" for _ in chunk)
        params = []
        for movement in chunk:
            member_reference = str(movement.get("member_reference") or "").strip()
            holder_name = str(movement.get("holder_name") or "").strip()
            movement_date = movement.get("movement_date") or parsed["document_date"]
            params.extend(
                [
                    file_id,
                    parsed["document_date"].isoformat(),
                    movement_date.isoformat() if isinstance(movement_date, date) else str(movement_date),
                    parsed.get("logical_batch_id"),
                    parsed["inferred_role"],
                    member_reference,
                    _normalize_reference(member_reference),
                    holder_name,
                    _normalize_text(holder_name),
                    movement.get("iban"),
                    f"{Decimal(str(movement.get('amount') or '0')):.2f}",
                    str(movement.get("reason_code") or "").upper(),
                    str(movement.get("reason_description") or ""),
                    movement.get("collection_reference"),
                    movement.get("bank_service_reference"),
                    int(movement.get("sequence_no") or 0),
                ]
            )

        execute_d1_query(
            f"""
            INSERT INTO bank_index_movements (
                file_id, document_date, movement_date, logical_batch_id,
                inferred_role, member_reference, member_reference_norm,
                holder_name, holder_name_norm, iban, amount, reason_code,
                reason_description, collection_reference,
                bank_service_reference, sequence_no
            ) VALUES {placeholders}
            """,
            params,
        )


def _index_one_file(calendar_file) -> tuple[int, str | None]:
    _delete_index_for_file(calendar_file.id)
    try:
        parsed = _parse_file_for_index(calendar_file)
        execute_d1_query(
            """
            INSERT INTO bank_index_files (
                file_id, calendar_date, document_date, filename, file_type,
                stored_category, inferred_role, logical_batch_id, message_id,
                original_message_id, declared_transactions, parsed_transactions,
                recovery_part, related_file_id, indexed_at, index_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                calendar_date = excluded.calendar_date,
                document_date = excluded.document_date,
                filename = excluded.filename,
                file_type = excluded.file_type,
                stored_category = excluded.stored_category,
                inferred_role = excluded.inferred_role,
                logical_batch_id = excluded.logical_batch_id,
                message_id = excluded.message_id,
                original_message_id = excluded.original_message_id,
                declared_transactions = excluded.declared_transactions,
                parsed_transactions = excluded.parsed_transactions,
                recovery_part = excluded.recovery_part,
                related_file_id = excluded.related_file_id,
                indexed_at = excluded.indexed_at,
                index_error = excluded.index_error
            """,
            [
                calendar_file.id,
                calendar_file.calendar_date.isoformat(),
                parsed["document_date"].isoformat(),
                calendar_file.original_filename,
                calendar_file.file_type,
                calendar_file.file_category or "normal",
                parsed["inferred_role"],
                parsed.get("logical_batch_id"),
                parsed.get("message_id"),
                parsed.get("original_message_id"),
                parsed.get("declared_transactions"),
                parsed.get("parsed_transactions"),
                calendar_file.recovery_part,
                calendar_file.related_file_id,
                datetime.utcnow().isoformat(),
                None,
            ],
        )
        _insert_movements(calendar_file.id, parsed)
        return len(parsed["movements"]), None
    except Exception as exc:
        error_text = str(exc)
        execute_d1_query(
            """
            INSERT INTO bank_index_files (
                file_id, calendar_date, document_date, filename, file_type,
                stored_category, inferred_role, logical_batch_id, message_id,
                original_message_id, declared_transactions, parsed_transactions,
                recovery_part, related_file_id, indexed_at, index_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                calendar_date = excluded.calendar_date,
                document_date = excluded.document_date,
                filename = excluded.filename,
                file_type = excluded.file_type,
                stored_category = excluded.stored_category,
                inferred_role = excluded.inferred_role,
                logical_batch_id = excluded.logical_batch_id,
                message_id = excluded.message_id,
                original_message_id = excluded.original_message_id,
                declared_transactions = excluded.declared_transactions,
                parsed_transactions = excluded.parsed_transactions,
                recovery_part = excluded.recovery_part,
                related_file_id = excluded.related_file_id,
                indexed_at = excluded.indexed_at,
                index_error = excluded.index_error
            """,
            [
                calendar_file.id,
                calendar_file.calendar_date.isoformat(),
                calendar_file.calendar_date.isoformat(),
                calendar_file.original_filename,
                calendar_file.file_type,
                calendar_file.file_category or "normal",
                "error", None, None, None, None, 0,
                calendar_file.recovery_part,
                calendar_file.related_file_id,
                datetime.utcnow().isoformat(),
                error_text[:500],
            ],
        )
        return 0, error_text


def rebuild_bank_index(db: Session, *, months: int = 36) -> dict:
    if months not in ALLOWED_HISTORY_MONTHS:
        raise HTTPException(status_code=422, detail="Período inválido. Utilize 3, 6, 12, 24 ou 36 meses.")

    ensure_bank_index_schema()
    execute_d1_query("DELETE FROM bank_index_movements")
    execute_d1_query("DELETE FROM bank_index_files")

    end_date = date.today()
    start_date = _subtract_months(end_date, months)
    files = get_files_between_dates(db, start_date=start_date, end_date=end_date)

    indexed_movements = 0
    failures = []
    for calendar_file in files:
        count, error = _index_one_file(calendar_file)
        indexed_movements += count
        if error:
            failures.append({"file_id": calendar_file.id, "filename": calendar_file.original_filename, "error": error})

    return {
        "months": months,
        "start_date": start_date,
        "end_date": end_date,
        "indexed_files": len(files),
        "indexed_movements": indexed_movements,
        "failed_files": failures,
    }


def sync_bank_index(db: Session) -> dict:
    ensure_bank_index_schema()
    end_date = date.today()
    start_date = _subtract_months(end_date, MAX_SEARCH_MONTHS)
    files = get_files_between_dates(db, start_date=start_date, end_date=end_date)

    indexed_rows = get_d1_rows(
        "SELECT file_id, stored_category, recovery_part, related_file_id FROM bank_index_files"
    )
    indexed = {int(row["file_id"]): row for row in indexed_rows if row.get("file_id") is not None}
    current_ids = {int(item.id) for item in files}

    stale = set(indexed) - current_ids
    for file_id in stale:
        _delete_index_for_file(file_id)

    changed_files = 0
    movements = 0
    for calendar_file in files:
        row = indexed.get(int(calendar_file.id))
        needs = (
            row is None
            or str(row.get("stored_category") or "normal") != str(calendar_file.file_category or "normal")
            or row.get("recovery_part") != calendar_file.recovery_part
            or row.get("related_file_id") != calendar_file.related_file_id
        )
        if needs:
            count, error = _index_one_file(calendar_file)
            changed_files += 1
            movements += count

            if error:
                # Mantém o erro registado no D1, mas não transforma
                # uma pesquisa normal num erro 500/502.
                continue

    return {
        "new_or_changed_files": changed_files,
        "indexed_movements": movements,
        "removed_files": len(stale),
    }


def get_bank_index_status(db: Session) -> dict:
    del db
    ensure_bank_index_schema()
    files = get_d1_rows(
        """
        SELECT COUNT(*) AS total_files,
               SUM(CASE WHEN index_error IS NOT NULL THEN 1 ELSE 0 END) AS failed_files
        FROM bank_index_files
        """
    )
    movements = get_d1_rows("SELECT COUNT(*) AS total_movements FROM bank_index_movements")
    return {
        "indexed_files": int(files[0].get("total_files") or 0) if files else 0,
        "indexed_movements": int(movements[0].get("total_movements") or 0) if movements else 0,
        "failed_files": int(files[0].get("failed_files") or 0) if files else 0,
    }


# =========================================================
# MATCHING
# =========================================================


def _reference_match_score(search_reference: str, bank_code: str) -> tuple[int, str] | None:
    search_reference = _normalize_reference(search_reference)
    bank_code = _normalize_reference(bank_code)
    if not search_reference or not bank_code:
        return None
    if bank_code == search_reference:
        return 1000, "exact_reference"
    if not bank_code.endswith(search_reference):
        return None
    prefix = bank_code[: len(bank_code) - len(search_reference)]
    if not re.fullmatch(r"[AB]|\d+", prefix or ""):
        return None
    if len(search_reference) <= 3 and len(prefix) > 4:
        return None
    return 930 - min(len(prefix), 20) * 10, "reference_suffix"


def _name_match_score(query: str, holder_name: str) -> tuple[int, str] | None:
    query_n = _normalize_text(query)
    name_n = _normalize_text(holder_name)

    if not query_n or not name_n:
        return None

    if query_n == name_n:
        return 1000, "exact_name"

    query_tokens = query_n.split()
    name_tokens = name_n.split()

    if all(token in name_tokens for token in query_tokens):
        return 940, "name_tokens"

    if name_n.startswith(query_n):
        return 910, "name_prefix"

    # Pesquisa aproximada por palavra.
    # Ex.: "petrochinsky" deve encontrar "MARCELA PETROCHINSKI",
    # sem comparar a palavra pesquisada contra o nome completo.
    token_scores: list[float] = []

    for query_token in query_tokens:
        best_ratio = 0.0

        for name_token in name_tokens:
            if query_token == name_token:
                best_ratio = 1.0
                break

            # Evita tornar nomes muito curtos demasiado permissivos.
            if min(len(query_token), len(name_token)) < 4:
                continue

            ratio = SequenceMatcher(
                None,
                query_token,
                name_token,
            ).ratio()

            if ratio > best_ratio:
                best_ratio = ratio

        token_scores.append(best_ratio)

    if token_scores and all(score >= 0.82 for score in token_scores):
        average_ratio = sum(token_scores) / len(token_scores)

        # Uma única palavra aproximada recebe uma pontuação ligeiramente
        # inferior a uma correspondência exata de palavras.
        return (
            int(820 + average_ratio * 80),
            "similar_name",
        )

    ratio = SequenceMatcher(None, query_n, name_n).ratio()

    if ratio >= 0.88:
        return int(800 + ratio * 100), "similar_name"

    return None


def _candidate_key(*, query: str, numeric_search: bool, bank_code: str, holder_name: str) -> str:
    if numeric_search:
        payload = "|".join(["REF", _normalize_reference(query), _normalize_text(holder_name)])
    else:
        payload = "|".join(["NAME", _normalize_text(holder_name), _normalize_reference(bank_code)])
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:20]


def _query_rows_for_search(*, query: str, start_date: date) -> list[dict]:
    if _looks_numeric_search(query):
        ref = _normalize_reference(query)
        return get_d1_rows(
            """
            SELECT m.*, f.filename, f.file_type, f.stored_category,
                   f.message_id, f.original_message_id,
                   f.recovery_part, f.related_file_id
            FROM bank_index_movements m
            JOIN bank_index_files f ON f.file_id = m.file_id
            WHERE m.document_date >= ?
              AND (m.member_reference_norm = ? OR m.member_reference_norm LIKE ?)
              AND f.index_error IS NULL
            ORDER BY m.document_date DESC, m.file_id DESC
            """,
            [start_date.isoformat(), ref, f"%{ref}"],
        )

    name = _normalize_text(query)
    if not name:
        return []
    first = name.split()[0]
    fragment = first[: max(3, len(first) - 1)]
    return get_d1_rows(
        """
        SELECT m.*, f.filename, f.file_type, f.stored_category,
               f.message_id, f.original_message_id,
               f.recovery_part, f.related_file_id
        FROM bank_index_movements m
        JOIN bank_index_files f ON f.file_id = m.file_id
        WHERE m.document_date >= ?
          AND m.holder_name_norm LIKE ?
          AND f.index_error IS NULL
        ORDER BY m.document_date DESC, m.file_id DESC
        """,
        [start_date.isoformat(), f"%{fragment}%"],
    )


def _row_matches(query: str, numeric_search: bool, row: dict) -> tuple[int, str] | None:
    if numeric_search:
        return _reference_match_score(query, str(row.get("member_reference") or ""))
    return _name_match_score(query, str(row.get("holder_name") or ""))


def search_bank_candidates(db: Session, *, query: str) -> dict:
    query = query.strip()
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Introduza pelo menos 2 caracteres para efetuar a pesquisa.")

    sync_bank_index(db)
    numeric = _looks_numeric_search(query)
    rows = _query_rows_for_search(query=query, start_date=_subtract_months(date.today(), MAX_SEARCH_MONTHS))
    grouped = {}

    for row in rows:
        match = _row_matches(query, numeric, row)
        if match is None:
            continue
        score, match_type = match
        bank_code = str(row.get("member_reference") or "").strip()
        holder = str(row.get("holder_name") or "").strip()
        key = _candidate_key(query=query, numeric_search=numeric, bank_code=bank_code, holder_name=holder)
        event_sig = "|".join(
            [
                str(row.get("logical_batch_id") or ""),
                str(row.get("inferred_role") or ""),
                str(row.get("collection_reference") or ""),
                _normalize_reference(bank_code),
                str(row.get("amount") or ""),
                str(row.get("reason_code") or ""),
            ]
        )
        d = _parse_iso_date(str(row.get("document_date") or ""), date.min)
        current = grouped.get(key)
        if current is None:
            grouped[key] = {
                "candidate_id": key,
                "searched_reference": query if numeric else None,
                "bank_reference_code": bank_code,
                "holder_name": holder,
                "iban": row.get("iban"),
                "match_type": match_type,
                "match_score": score,
                "movement_count": 1,
                "last_movement_date": d,
                "_events": {event_sig},
            }
        else:
            if event_sig not in current["_events"]:
                current["_events"].add(event_sig)
                current["movement_count"] += 1
            if score > current["match_score"]:
                current["match_score"] = score
                current["match_type"] = match_type
            if d > current["last_movement_date"]:
                current["last_movement_date"] = d
                current["bank_reference_code"] = bank_code
                current["holder_name"] = holder
                current["iban"] = row.get("iban")

    candidates = sorted(
        grouped.values(),
        key=lambda item: (item["match_score"], item["movement_count"], item["last_movement_date"] or date.min),
        reverse=True,
    )[:MAX_CANDIDATES]
    for item in candidates:
        item.pop("_events", None)
    return {"query": query, "candidates": candidates}


# =========================================================
# HISTÓRICO
# =========================================================


def _event_type(role: str) -> str:
    if role == "returned":
        return "returned"
    if role.startswith("recovery_"):
        return "recovery"
    return "normal"


def _event_identity(row: dict) -> str:
    return "|".join(
        [
            str(row.get("logical_batch_id") or ""),
            str(row.get("inferred_role") or ""),
            str(row.get("collection_reference") or ""),
            _normalize_reference(str(row.get("member_reference") or "")),
            f"{Decimal(str(row.get('amount') or '0')):.2f}",
            str(row.get("reason_code") or "").upper(),
        ]
    )


def _document(row: dict) -> dict:
    return {
        "file_id": int(row["file_id"]),
        "filename": str(row.get("filename") or ""),
        "file_type": str(row.get("file_type") or ""),
        "file_category": str(row.get("inferred_role") or row.get("stored_category") or "normal"),
        "download_url": f"/files/{int(row['file_id'])}/download",
    }


def _add_document_once(event: dict, document: dict) -> None:
    sig = (document["filename"], document["file_type"], document["file_category"])
    existing = {(d["filename"], d["file_type"], d["file_category"]) for d in event["documents"]}
    if sig not in existing:
        event["documents"].append(document)


def get_bank_history(db: Session, *, query: str, candidate_id: str, months: int) -> dict:
    query = query.strip()
    candidate_id = candidate_id.strip()
    if months not in ALLOWED_HISTORY_MONTHS:
        raise HTTPException(status_code=422, detail="Período inválido. Utilize 3, 6, 12, 24 ou 36 meses.")

    sync_bank_index(db)
    numeric = _looks_numeric_search(query)
    end_date = date.today()
    start_date = _subtract_months(end_date, months)
    rows = _query_rows_for_search(query=query, start_date=start_date)

    events = {}
    latest = None

    for row in rows:
        if _row_matches(query, numeric, row) is None:
            continue
        bank_code = str(row.get("member_reference") or "").strip()
        holder = str(row.get("holder_name") or "").strip()
        row_candidate = _candidate_key(query=query, numeric_search=numeric, bank_code=bank_code, holder_name=holder)
        if row_candidate != candidate_id:
            continue

        doc_date = _parse_iso_date(str(row.get("document_date") or ""), date.min)
        if latest is None or doc_date > latest["date"]:
            latest = {"date": doc_date, "bank_reference_code": bank_code, "holder_name": holder, "iban": row.get("iban")}

        identity = _event_identity(row)
        document = _document(row)
        current = events.get(identity)
        if current is None:
            role = str(row.get("inferred_role") or "normal")
            recovery_part = 1 if role == "recovery_initial" else 2 if role == "recovery_return" else None
            current = {
                "event_id": hashlib.sha1(identity.encode("utf-8")).hexdigest()[:20],
                "event_date": doc_date,
                "event_type": _event_type(role),
                "bank_reference_code": bank_code,
                "holder_name": holder,
                "iban": row.get("iban"),
                "amount": Decimal(str(row.get("amount") or "0")),
                "reason_code": str(row.get("reason_code") or "").upper(),
                "reason_description": str(row.get("reason_description") or ""),
                "collection_reference": str(row.get("collection_reference")) if row.get("collection_reference") is not None else None,
                "message_id": str(row.get("message_id")) if row.get("message_id") is not None else None,
                "original_message_id": str(row.get("original_message_id")) if row.get("original_message_id") is not None else None,
                "recovery_part": recovery_part,
                "related_file_id": int(row.get("related_file_id")) if row.get("related_file_id") is not None else None,
                "documents": [document],
            }
            events[identity] = current
        else:
            _add_document_once(current, document)
            if doc_date > current["event_date"]:
                current["event_date"] = doc_date

    if latest is None:
        raise HTTPException(status_code=404, detail="Não foram encontrados movimentos para este candidato no período escolhido.")

    ordered = sorted(
        events.values(),
        key=lambda item: (item["event_date"], item["collection_reference"] or "", item["event_id"]),
        reverse=True,
    )

    return {
        "candidate_id": candidate_id,
        "bank_reference_code": latest["bank_reference_code"],
        "holder_name": latest["holder_name"],
        "iban": latest["iban"],
        "months": months,
        "start_date": start_date,
        "end_date": end_date,
        "events": ordered,
    }
