from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from app.crud.calendar_file import (
    create_calendar_file,
    get_files_by_date,
)
from app.models.calendar_file import CalendarFile
from app.services.calendar_service import (
    build_r2_file_path,
    build_r2_object_key,
)
from app.services.r2_storage import (
    delete_object_from_r2,
    upload_bytes_to_r2,
)


# Identidade visual aprovada para o EPIC Payments.
EPIC_NAVY = colors.HexColor("#092D4A")
EPIC_BLUE = colors.HexColor("#0E5A8A")
EPIC_BLUE_SOFT = colors.HexColor("#EAF4FB")
EPIC_BLUE_BORDER = colors.HexColor("#C9DEEC")

EPIC_DARK = colors.HexColor("#152536")
EPIC_GRAY = colors.HexColor("#66788A")
EPIC_LIGHT = colors.HexColor("#F7FAFC")
EPIC_BORDER = colors.HexColor("#DCE6ED")

EPIC_GREEN = colors.HexColor("#16734A")
EPIC_GREEN_BG = colors.HexColor("#E7F7EF")
EPIC_RED = colors.HexColor("#C84242")
EPIC_RED_BG = colors.HexColor("#FCECEC")

PAGE_WIDTH, PAGE_HEIGHT = A4


def _format_amount(value: Decimal) -> str:
    normalized = Decimal(value).quantize(
        Decimal("0.01")
    )

    return (
        f"{normalized:.2f}"
        .replace(".", ",")
        + " €"
    )


def _safe_text(value: object, fallback: str = "—") -> str:
    text = str(value or "").strip()

    if not text:
        text = fallback

    return escape(text)


def _build_report_name(
    db: Session,
    *,
    calendar_date: date,
) -> str:
    date_label = calendar_date.strftime(
        "%d/%m/%y"
    )

    existing_names = {
        file.original_filename.lower()
        for file in get_files_by_date(
            db,
            calendar_date,
        )
        if file.file_type == "report"
    }

    base_name = (
        f"RELATORIO_{date_label}"
    )

    candidate = (
        f"{base_name}.pdf"
    )

    if (
        candidate.lower()
        not in existing_names
    ):
        return candidate

    index = 1

    while True:
        candidate = (
            f"{base_name}_{index}.pdf"
        )

        if (
            candidate.lower()
            not in existing_names
        ):
            return candidate

        index += 1


def _find_logo_path() -> Path | None:
    current_file = Path(
        __file__
    ).resolve()

    candidates = [
        current_file.parents[3]
        / "frontend"
        / "public"
        / "branding"
        / "logo-epic-payments-all-white.png",

        current_file.parents[2]
        / "assets"
        / "logo-epic-payments-all-white.png",

        Path.cwd()
        / ".."
        / "frontend"
        / "public"
        / "branding"
        / "logo-epic-payments-all-white.png",
    ]

    for candidate in candidates:
        if (
            candidate.exists()
            and candidate.is_file()
        ):
            return candidate

    return None


def _draw_header(
    canvas,
    document,
    *,
    generated_at: datetime,
    generated_by_name: str,
) -> None:
    canvas.saveState()

    # Cabeçalho azul integral.
    header_height = 58 * mm

    canvas.setFillColor(
        EPIC_NAVY
    )
    canvas.rect(
        0,
        PAGE_HEIGHT - header_height,
        PAGE_WIDTH,
        header_height,
        fill=1,
        stroke=0,
    )

    # Pequena linha azul clara no limite inferior.
    canvas.setFillColor(
        EPIC_BLUE
    )
    canvas.rect(
        0,
        PAGE_HEIGHT - header_height,
        PAGE_WIDTH,
        0.8 * mm,
        fill=1,
        stroke=0,
    )

    logo_path = _find_logo_path()

    if logo_path is not None:
        try:
            canvas.drawImage(
                str(logo_path),
                12 * mm,
                PAGE_HEIGHT - 22 * mm,
                width=48 * mm,
                height=15 * mm,
                preserveAspectRatio=True,
                anchor="sw",
                mask="auto",
            )
        except Exception:
            canvas.setFillColor(
                colors.white
            )
            canvas.setFont(
                "Helvetica-Bold",
                14,
            )
            canvas.drawString(
                12 * mm,
                PAGE_HEIGHT - 16 * mm,
                "EPIC PAYMENTS",
            )
    else:
        canvas.setFillColor(
            colors.white
        )
        canvas.setFont(
            "Helvetica-Bold",
            14,
        )
        canvas.drawString(
            12 * mm,
            PAGE_HEIGHT - 16 * mm,
            "EPIC PAYMENTS",
        )

    # Título.
    canvas.setFillColor(
        colors.white
    )
    canvas.setFont(
        "Helvetica-Bold",
        21,
    )
    canvas.drawString(
        12 * mm,
        PAGE_HEIGHT - 36 * mm,
        "Relatório de Comunicação",
    )

    canvas.setFillColor(
        colors.HexColor("#D8E8F3")
    )
    canvas.setFont(
        "Helvetica",
        8.5,
    )
    canvas.drawString(
        12 * mm,
        PAGE_HEIGHT - 43 * mm,
        "Mensalidades não cobradas e respetivo estado de comunicação.",
    )

    # Separador da informação de geração.
    divider_x = PAGE_WIDTH - 63 * mm
    canvas.setStrokeColor(
        colors.HexColor("#6E94AE")
    )
    canvas.setLineWidth(
        0.6
    )
    canvas.line(
        divider_x,
        PAGE_HEIGHT - 48 * mm,
        divider_x,
        PAGE_HEIGHT - 27 * mm,
    )

    info_x = divider_x + 7 * mm

    canvas.setFillColor(
        colors.HexColor("#BFD6E5")
    )
    canvas.setFont(
        "Helvetica",
        6.8,
    )
    canvas.drawString(
        info_x,
        PAGE_HEIGHT - 31 * mm,
        "GERADO EM",
    )

    canvas.setFillColor(
        colors.white
    )
    canvas.setFont(
        "Helvetica-Bold",
        8,
    )
    canvas.drawString(
        info_x,
        PAGE_HEIGHT - 35.5 * mm,
        generated_at.strftime(
            "%d/%m/%Y às %H:%M"
        ),
    )

    canvas.setFillColor(
        colors.HexColor("#BFD6E5")
    )
    canvas.setFont(
        "Helvetica",
        6.8,
    )
    canvas.drawString(
        info_x,
        PAGE_HEIGHT - 42 * mm,
        "COLABORADOR",
    )

    canvas.setFillColor(
        colors.white
    )
    canvas.setFont(
        "Helvetica-Bold",
        8,
    )
    canvas.drawString(
        info_x,
        PAGE_HEIGHT - 46.5 * mm,
        generated_by_name or "—",
    )

    # Rodapé minimalista.
    canvas.setStrokeColor(
        EPIC_BORDER
    )
    canvas.setLineWidth(
        0.45
    )
    canvas.line(
        12 * mm,
        13 * mm,
        PAGE_WIDTH - 12 * mm,
        13 * mm,
    )

    canvas.setFillColor(
        colors.HexColor("#7C8B99")
    )
    canvas.setFont(
        "Helvetica",
        6.5,
    )
    canvas.drawRightString(
        PAGE_WIDTH - 12 * mm,
        8.5 * mm,
        (
            "EPIC PAYMENTS · RELATÓRIO DE COMUNICAÇÃO"
            f" · PÁGINA {document.page}"
        ),
    )

    canvas.restoreState()


def _build_pdf(
    *,
    calendar_date: date,
    source_filename: str,
    rows: list[dict],
    generated_at: datetime,
    generated_by_name: str,
) -> bytes:
    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=7 * mm,
        leftMargin=7 * mm,
        topMargin=64 * mm,
        bottomMargin=18 * mm,
        title="Relatório de Comunicação",
        author="EPIC Payments",
    )

    styles = getSampleStyleSheet()

    meta_label_style = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.8,
        leading=8,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    meta_value_style = ParagraphStyle(
        "MetaValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=EPIC_DARK,
        alignment=TA_LEFT,
    )

    stat_label_style = ParagraphStyle(
        "StatLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.2,
        leading=8.5,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    stat_value_style = ParagraphStyle(
        "StatValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=21,
        textColor=EPIC_DARK,
        alignment=TA_LEFT,
    )

    cell_style = ParagraphStyle(
        "Cell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.3,
        leading=7.5,
        textColor=EPIC_DARK,
        alignment=TA_LEFT,
        wordWrap="CJK",
    )

    cell_bold_style = ParagraphStyle(
        "CellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )

    header_style = ParagraphStyle(
        "Header",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.1,
        leading=7,
        textColor=colors.white,
        alignment=TA_CENTER,
    )

    status_sent_style = ParagraphStyle(
        "StatusSent",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.3,
        leading=7,
        textColor=EPIC_GREEN,
        alignment=TA_CENTER,
    )

    status_failed_style = ParagraphStyle(
        "StatusFailed",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.3,
        leading=7,
        textColor=EPIC_RED,
        alignment=TA_CENTER,
    )

    note_style = ParagraphStyle(
        "Note",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.2,
        leading=9.5,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    story = []

    # Apenas os dois campos aprovados: sem BASE CEDIS no relatório.
    meta_table = Table(
        [
            [
                [
                    Paragraph(
                        "DATA DO PROCESSAMENTO",
                        meta_label_style,
                    ),
                    Spacer(1, 1.2 * mm),
                    Paragraph(
                        calendar_date.strftime(
                            "%d/%m/%Y"
                        ),
                        meta_value_style,
                    ),
                ],
                [
                    Paragraph(
                        "FICHEIRO BANCÁRIO",
                        meta_label_style,
                    ),
                    Spacer(1, 1.2 * mm),
                    Paragraph(
                        _safe_text(
                            source_filename,
                            "Ficheiro bancário",
                        ),
                        meta_value_style,
                    ),
                ],
            ],
        ],
        colWidths=[
            63 * mm,
            126 * mm,
        ],
    )

    meta_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.white,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    EPIC_BLUE_BORDER,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.45,
                    EPIC_BORDER,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    9,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    9,
                ),
            ]
        )
    )

    story.append(
        meta_table
    )

    story.append(
        Spacer(
            1,
            4.5 * mm,
        )
    )

    sent_count = sum(
        1
        for row in rows
        if (
            row.get(
                "sms_status"
            )
            == "sent"
        )
    )

    justified_count = (
        len(rows)
        - sent_count
    )

    stat_cards = Table(
        [
            [
                [
                    Paragraph(
                        "PROCESSOS",
                        stat_label_style,
                    ),
                    Spacer(1, 1.2 * mm),
                    Paragraph(
                        str(
                            len(rows)
                        ),
                        stat_value_style,
                    ),
                ],
                [
                    Paragraph(
                        "SMS ENVIADOS",
                        stat_label_style,
                    ),
                    Spacer(1, 1.2 * mm),
                    Paragraph(
                        str(
                            sent_count
                        ),
                        stat_value_style,
                    ),
                ],
                [
                    Paragraph(
                        "NÃO ENVIADOS / JUSTIFICADOS",
                        stat_label_style,
                    ),
                    Spacer(1, 1.2 * mm),
                    Paragraph(
                        str(
                            justified_count
                        ),
                        stat_value_style,
                    ),
                ],
            ],
        ],
        colWidths=[
            61 * mm,
            61 * mm,
            67 * mm,
        ],
    )

    stat_cards.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, 0),
                    EPIC_BLUE_SOFT,
                ),
                (
                    "BACKGROUND",
                    (1, 0),
                    (1, 0),
                    EPIC_GREEN_BG,
                ),
                (
                    "BACKGROUND",
                    (2, 0),
                    (2, 0),
                    EPIC_RED_BG,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    EPIC_BORDER,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    colors.white,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    9,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    9,
                ),
            ]
        )
    )

    story.append(
        KeepTogether(
            [
                stat_cards,
                Spacer(
                    1,
                    5 * mm,
                ),
            ]
        )
    )

    table_data = [
        [
            Paragraph(
                "Nº SÓCIO",
                header_style,
            ),
            Paragraph(
                "NOME",
                header_style,
            ),
            Paragraph(
                "TELEMÓVEL",
                header_style,
            ),
            Paragraph(
                "VALOR",
                header_style,
            ),
            Paragraph(
                "ENT.",
                header_style,
            ),
            Paragraph(
                "REFERÊNCIA",
                header_style,
            ),
            Paragraph(
                "SMS",
                header_style,
            ),
            Paragraph(
                "MOTIVO",
                header_style,
            ),
        ]
    ]

    for row in rows:
        sms_sent = (
            row.get(
                "sms_status"
            )
            == "sent"
        )

        status_label = (
            "Enviado"
            if sms_sent
            else "Não enviado"
        )

        reason = (
            str(
                row.get(
                    "reason"
                )
                or ""
            ).strip()
            or "—"
        )

        table_data.append(
            [
                Paragraph(
                    _safe_text(
                        row.get(
                            "member_number"
                        )
                    ),
                    cell_bold_style,
                ),
                Paragraph(
                    _safe_text(
                        row.get(
                            "name"
                        )
                    ),
                    cell_style,
                ),
                Paragraph(
                    _safe_text(
                        row.get(
                            "phone"
                        )
                    ),
                    cell_style,
                ),
                Paragraph(
                    _format_amount(
                        Decimal(
                            str(
                                row.get(
                                    "value"
                                )
                            )
                        )
                    ),
                    cell_bold_style,
                ),
                Paragraph(
                    _safe_text(
                        row.get(
                            "entity"
                        )
                    ),
                    cell_style,
                ),
                Paragraph(
                    _safe_text(
                        row.get(
                            "reference"
                        )
                    ),
                    cell_style,
                ),
                Paragraph(
                    status_label,
                    (
                        status_sent_style
                        if sms_sent
                        else status_failed_style
                    ),
                ),
                Paragraph(
                    _safe_text(
                        reason
                    ),
                    cell_style,
                ),
            ]
        )

    table = Table(
        table_data,
        repeatRows=1,
        colWidths=[
            16 * mm,
            35 * mm,
            25 * mm,
            18 * mm,
            15 * mm,
            26 * mm,
            21 * mm,
            33 * mm,
        ],
        hAlign="LEFT",
    )

    table_style_commands = [
        (
            "BACKGROUND",
            (0, 0),
            (-1, 0),
            EPIC_NAVY,
        ),
        (
            "BOX",
            (0, 0),
            (-1, -1),
            0.6,
            EPIC_BORDER,
        ),
        (
            "INNERGRID",
            (0, 1),
            (-1, -1),
            0.3,
            EPIC_BORDER,
        ),
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "MIDDLE",
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, -1),
            5.5,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            5.5,
        ),
        (
            "ROWBACKGROUNDS",
            (0, 1),
            (-1, -1),
            [
                colors.white,
                EPIC_LIGHT,
            ],
        ),
    ]

    for index, row in enumerate(
        rows,
        start=1,
    ):
        if (
            row.get(
                "sms_status"
            )
            == "sent"
        ):
            table_style_commands.extend(
                [
                    (
                        "BACKGROUND",
                        (6, index),
                        (6, index),
                        EPIC_GREEN_BG,
                    ),
                    (
                        "TEXTCOLOR",
                        (6, index),
                        (6, index),
                        EPIC_GREEN,
                    ),
                ]
            )
        else:
            table_style_commands.extend(
                [
                    (
                        "BACKGROUND",
                        (6, index),
                        (6, index),
                        EPIC_RED_BG,
                    ),
                    (
                        "TEXTCOLOR",
                        (6, index),
                        (6, index),
                        EPIC_RED,
                    ),
                ]
            )

    table.setStyle(
        TableStyle(
            table_style_commands
        )
    )

    story.append(
        table
    )

    story.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    note_table = Table(
        [
            [
                Paragraph(
                    (
                        "<b>Documento gerado automaticamente pelo EPIC Payments.</b><br/>"
                        "Os processos sem SMS enviado encontram-se acompanhados "
                        "da respetiva justificação."
                    ),
                    note_style,
                )
            ]
        ],
        colWidths=[
            189 * mm,
        ],
    )

    note_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    EPIC_LIGHT,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.6,
                    EPIC_BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
            ]
        )
    )

    story.append(
        note_table
    )

    page_callback = lambda canvas, doc: _draw_header(
        canvas,
        doc,
        generated_at=generated_at,
        generated_by_name=generated_by_name,
    )

    document.build(
        story,
        onFirstPage=page_callback,
        onLaterPages=page_callback,
    )

    return buffer.getvalue()


def create_communication_report(
    db: Session,
    *,
    calendar_date: date,
    source_file_id: int | None,
    source_filename: str,
    cedis_filename: str,
    rows: list[dict],
    uploaded_by_id: int | None,
    generated_by_name: str = "",
) -> CalendarFile:
    if not rows:
        raise ValueError(
            "O relatório não contém processos."
        )

    unresolved = [
        row
        for row in rows
        if (
            row.get(
                "sms_status"
            )
            != "sent"
            and len(
                str(
                    row.get(
                        "reason"
                    )
                    or ""
                ).strip()
            ) < 3
        )
    ]

    if unresolved:
        raise ValueError(
            "Existem processos por justificar."
        )

    original_filename = (
        _build_report_name(
            db,
            calendar_date=calendar_date,
        )
    )

    # A hora fica registada em Portugal, independentemente
    # do fuso horário do servidor Render.
    generated_at = datetime.now(
        ZoneInfo("Europe/Lisbon")
    )

    # Mantemos cedis_filename na assinatura para não alterar
    # o contrato interno existente. Ele deixa apenas de ser
    # apresentado visualmente no PDF.
    _ = cedis_filename

    pdf_bytes = _build_pdf(
        calendar_date=calendar_date,
        source_filename=source_filename,
        rows=rows,
        generated_at=generated_at,
        generated_by_name=(
            generated_by_name.strip()
            or "—"
        ),
    )

    stored_filename = (
        f"{uuid4().hex}.pdf"
    )

    object_key = (
        build_r2_object_key(
            calendar_date=calendar_date,
            file_type="report",
            stored_filename=stored_filename,
        )
    )

    upload_bytes_to_r2(
        object_key=object_key,
        contents=pdf_bytes,
        content_type="application/pdf",
    )

    try:
        return create_calendar_file(
            db,
            calendar_date=calendar_date,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_type="report",
            mime_type="application/pdf",
            file_size=len(pdf_bytes),
            file_path=build_r2_file_path(
                object_key
            ),
            uploaded_by_id=uploaded_by_id,
            file_category="normal",
            recovery_part=None,
            related_file_id=source_file_id,
        )
    except Exception:
        try:
            delete_object_from_r2(
                object_key=object_key,
            )
        except Exception:
            pass

        raise
