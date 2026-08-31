from __future__ import annotations

from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from uuid import uuid4

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


EPIC_RED = colors.HexColor("#B4000B")
EPIC_DARK = colors.HexColor("#151515")
EPIC_GRAY = colors.HexColor("#6A6A6A")
EPIC_LIGHT = colors.HexColor("#F5F5F6")
EPIC_BORDER = colors.HexColor("#E2E2E4")
EPIC_GREEN = colors.HexColor("#16743B")
EPIC_GREEN_BG = colors.HexColor("#E9F7EE")
EPIC_RED_BG = colors.HexColor("#FFF0F1")


def _format_amount(
    value: Decimal,
) -> str:
    normalized = Decimal(value).quantize(
        Decimal("0.01")
    )

    return (
        f"{normalized:.2f}"
        .replace(".", ",")
        + " €"
    )


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
        / "logo-epic-payments-dark.png",

        current_file.parents[2]
        / "assets"
        / "logo-epic-payments-dark.png",

        Path.cwd()
        / ".."
        / "frontend"
        / "public"
        / "branding"
        / "logo-epic-payments-dark.png",
    ]

    for candidate in candidates:
        if (
            candidate.exists()
            and candidate.is_file()
        ):
            return candidate

    return None


def _draw_page_decorations(
    canvas,
    document,
) -> None:
    canvas.saveState()

    page_width, page_height = A4

    canvas.setFillColor(
        EPIC_RED
    )
    canvas.rect(
        0,
        page_height - 4 * mm,
        page_width,
        4 * mm,
        fill=1,
        stroke=0,
    )

    canvas.setStrokeColor(
        EPIC_BORDER
    )
    canvas.setLineWidth(
        0.6
    )
    canvas.line(
        14 * mm,
        13 * mm,
        page_width - 14 * mm,
        13 * mm,
    )

    canvas.setFillColor(
        colors.HexColor(
            "#8A8A8A"
        )
    )
    canvas.setFont(
        "Helvetica",
        7,
    )
    canvas.drawString(
        14 * mm,
        8.5 * mm,
        "EPIC Payments · Relatório de Comunicação",
    )

    canvas.drawRightString(
        page_width - 14 * mm,
        8.5 * mm,
        f"Página {document.page}",
    )

    canvas.restoreState()


def _build_pdf(
    *,
    calendar_date: date,
    source_filename: str,
    cedis_filename: str,
    rows: list[dict],
) -> bytes:
    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title="Relatório de Comunicação",
        author="EPIC Payments",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "EpicTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=22,
        textColor=EPIC_DARK,
        alignment=TA_LEFT,
        spaceAfter=3,
    )

    eyebrow_style = ParagraphStyle(
        "EpicEyebrow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=EPIC_RED,
        alignment=TA_LEFT,
        spaceAfter=3,
        tracking=1.2,
    )

    subtitle_style = ParagraphStyle(
        "EpicSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    meta_label_style = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.2,
        leading=9,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    meta_value_style = ParagraphStyle(
        "MetaValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.2,
        leading=10,
        textColor=EPIC_DARK,
        alignment=TA_LEFT,
    )

    stat_label_style = ParagraphStyle(
        "StatLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.8,
        leading=8,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    stat_value_style = ParagraphStyle(
        "StatValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=17,
        textColor=EPIC_DARK,
        alignment=TA_LEFT,
    )

    cell_style = ParagraphStyle(
        "Cell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.4,
        leading=7.8,
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

    story = []

    logo_path = _find_logo_path()

    header_left = [
        Paragraph(
            "EPIC PAYMENTS",
            eyebrow_style,
        ),
        Paragraph(
            "Relatório de Comunicação",
            title_style,
        ),
        Paragraph(
            "Mensalidades não cobradas e respetivo estado de comunicação.",
            subtitle_style,
        ),
    ]

    if logo_path is not None:
        logo = Image(
            str(
                logo_path
            ),
            width=47 * mm,
            height=18 * mm,
        )

        header_table = Table(
            [
                [
                    header_left,
                    logo,
                ]
            ],
            colWidths=[
                119 * mm,
                49 * mm,
            ],
        )

        header_table.setStyle(
            TableStyle(
                [
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                    (
                        "ALIGN",
                        (1, 0),
                        (1, 0),
                        "RIGHT",
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        0,
                    ),
                    (
                        "RIGHTPADDING",
                        (0, 0),
                        (-1, -1),
                        0,
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        0,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        0,
                    ),
                ]
            )
        )

        story.append(
            header_table
        )
    else:
        story.extend(
            header_left
        )

    story.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    meta_table = Table(
        [
            [
                Paragraph(
                    "DATA DO PROCESSAMENTO",
                    meta_label_style,
                ),
                Paragraph(
                    "FICHEIRO BANCÁRIO",
                    meta_label_style,
                ),
                Paragraph(
                    "BASE CEDIS",
                    meta_label_style,
                ),
            ],
            [
                Paragraph(
                    calendar_date.strftime(
                        "%d/%m/%Y"
                    ),
                    meta_value_style,
                ),
                Paragraph(
                    source_filename
                    or "Ficheiro bancário",
                    meta_value_style,
                ),
                Paragraph(
                    cedis_filename
                    or "—",
                    meta_value_style,
                ),
            ],
        ],
        colWidths=[
            42 * mm,
            66 * mm,
            60 * mm,
        ],
    )

    meta_table.setStyle(
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
                    0.7,
                    EPIC_BORDER,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.35,
                    EPIC_BORDER,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, 0),
                    7,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, 0),
                    2,
                ),
                (
                    "TOPPADDING",
                    (0, 1),
                    (-1, 1),
                    1,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 1),
                    (-1, 1),
                    8,
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
            5 * mm,
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
                    Paragraph(
                        str(
                            justified_count
                        ),
                        stat_value_style,
                    ),
                ],
            ]
        ],
        colWidths=[
            51 * mm,
            51 * mm,
            66 * mm,
        ],
    )

    stat_cards.setStyle(
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
                    0.8,
                    EPIC_BORDER,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
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
                    8,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
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
                    6 * mm,
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
                    str(
                        row.get(
                            "member_number"
                        )
                        or "—"
                    ),
                    cell_bold_style,
                ),
                Paragraph(
                    str(
                        row.get(
                            "name"
                        )
                        or "—"
                    ),
                    cell_bold_style,
                ),
                Paragraph(
                    str(
                        row.get(
                            "phone"
                        )
                        or "—"
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
                    str(
                        row.get(
                            "entity"
                        )
                        or "—"
                    ),
                    cell_style,
                ),
                Paragraph(
                    str(
                        row.get(
                            "reference"
                        )
                        or "—"
                    ),
                    cell_style,
                ),
                Paragraph(
                    status_label,
                    cell_bold_style,
                ),
                Paragraph(
                    reason,
                    cell_style,
                ),
            ]
        )

    table = Table(
        table_data,
        repeatRows=1,
        colWidths=[
            15 * mm,
            31 * mm,
            23 * mm,
            18 * mm,
            15 * mm,
            24 * mm,
            20 * mm,
            42 * mm,
        ],
        hAlign="LEFT",
    )

    table_style_commands = [
        (
            "BACKGROUND",
            (0, 0),
            (-1, 0),
            EPIC_DARK,
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
            (0, 1),
            (-1, -1),
            0.35,
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
            5,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            5,
        ),
        (
            "ROWBACKGROUNDS",
            (0, 1),
            (-1, -1),
            [
                colors.white,
                colors.HexColor(
                    "#FAFAFB"
                ),
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

    note_style = ParagraphStyle(
        "Note",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.2,
        leading=9,
        textColor=EPIC_GRAY,
        alignment=TA_LEFT,
    )

    story.append(
        Paragraph(
            (
                "Documento gerado automaticamente pelo EPIC Payments. "
                "Os processos sem SMS enviado encontram-se acompanhados "
                "da respetiva justificação."
            ),
            note_style,
        )
    )

    document.build(
        story,
        onFirstPage=_draw_page_decorations,
        onLaterPages=_draw_page_decorations,
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

    pdf_bytes = _build_pdf(
        calendar_date=calendar_date,
        source_filename=source_filename,
        cedis_filename=cedis_filename,
        rows=rows,
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
