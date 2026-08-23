BANK_REASON_CODES: dict[str, str] = {
    "0000": (
        "Normal; lançamento executado; "
        "relação de dados válida."
    ),

    "AM04": (
        "Insuficiência de fundos."
    ),

    "AC06": (
        "Conta bloqueada para débitos "
        "directos pelo devedor."
    ),

    "AG01": (
        "Débito directo não permitido "
        "para esta conta por motivos regulamentares."
    ),

    "MS02": (
        "Recusado pelo Devedor/razão não "
        "especificada por parte do Devedor."
    ),

    "MS03": (
        "Motivo não especificado / razão não "
        "especificada por parte do agente."
    ),

    "RJ11": (
        "Autorização está inativa pelo "
        "Devedor ou Banco do Devedor."
    ),

    "RS05": (
        'Tipo de movimento = "RCUR" ou "FNAL" '
        "sem indicador de alteração, mas não existe "
        "Autorização para o Banco Devedor/IBAN."
    ),

    "SL01": (
        "Serviço específico oferecido "
        "pelo Banco do Devedor (DD)."
    ),
}


UNKNOWN_REASON_DESCRIPTION = (
    "Novo tipo de código — verifique a descrição "
    "no formato PDF."
)


def get_reason_description(
    reason_code: str | None,
) -> str:
    """
    Devolve a descrição conhecida do código bancário.

    Quando surge um código novo que ainda não está
    registado no EPIC Payments, mantém o código original
    e apresenta uma indicação para consultar o PDF.
    """

    code = (
        reason_code
        or ""
    ).strip().upper()

    if not code:
        return UNKNOWN_REASON_DESCRIPTION

    return BANK_REASON_CODES.get(
        code,
        UNKNOWN_REASON_DESCRIPTION,
    )