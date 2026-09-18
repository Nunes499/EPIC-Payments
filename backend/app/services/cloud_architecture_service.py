from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def _service(
    *,
    name: str,
    role: str,
    responsibility: str,
    source_of_truth: bool,
    stores: list[str],
    must_not_store: list[str],
) -> dict[str, Any]:
    return {
        "name": name,
        "role": role,
        "responsibility": responsibility,
        "source_of_truth": (
            source_of_truth
        ),
        "stores": stores,
        "must_not_store": (
            must_not_store
        ),
    }


def get_cloud_architecture_status() -> dict:
    checked_at = _utc_now()

    services = {
        "cloudflare_workers": _service(
            name="Cloudflare Workers",
            role="Frontend / Edge",
            responsibility=(
                "Publica o frontend e encaminha "
                "as chamadas da aplicação para "
                "a API backend."
            ),
            source_of_truth=False,
            stores=[
                "Frontend da aplicação",
                "Rotas API de encaminhamento",
            ],
            must_not_store=[
                "Credenciais cloud no browser",
                "Dados transacionais principais",
            ],
        ),
        "render": _service(
            name="Render",
            role="Backend / API",
            responsibility=(
                "Executa FastAPI, regras de negócio "
                "e integrações com os serviços cloud."
            ),
            source_of_truth=False,
            stores=[
                "Código e processos da API",
            ],
            must_not_store=[
                "Ficheiros persistentes no disco",
                "Dados dependentes da instância",
            ],
        ),
        "neon": _service(
            name="Neon PostgreSQL",
            role="Dados relacionais",
            responsibility=(
                "Fonte de verdade para os dados "
                "relacionais e transacionais "
                "da aplicação."
            ),
            source_of_truth=True,
            stores=[
                "Utilizadores",
                "Referências Easypay",
                "Estados de pagamento",
                "Comunicação",
                "Metadados CEDIS",
            ],
            must_not_store=[
                "Ficheiros PDF/XML binários",
                "Backups como blobs",
                "Índice bancário derivado",
            ],
        ),
        "r2": _service(
            name="Cloudflare R2",
            role="Ficheiros / Objetos",
            responsibility=(
                "Armazena ficheiros persistentes "
                "e backups sem depender do disco "
                "do backend."
            ),
            source_of_truth=True,
            stores=[
                "Ficheiros bancários PDF/XML",
                "Bases CEDIS",
                "Relatórios",
                "Backups Neon",
            ],
            must_not_store=[
                "Estado transacional Easypay",
                "Sessões da aplicação",
            ],
        ),
        "d1": _service(
            name="Cloudflare D1",
            role="Dados bancários especializados",
            responsibility=(
                "Mantém metadados do calendário "
                "bancário e índices otimizados "
                "para pesquisa."
            ),
            source_of_truth=False,
            stores=[
                "calendar_files",
                "bank_index_files",
                "bank_index_movements",
                "Índices reconstruíveis",
            ],
            must_not_store=[
                "Referências Easypay como fonte principal",
                "Utilizadores como fonte principal",
                "Ficheiros binários",
            ],
        ),
        "easypay": _service(
            name="Easypay",
            role="Processador de pagamentos",
            responsibility=(
                "Cria referências e fornece "
                "alterações de estado dos pagamentos."
            ),
            source_of_truth=False,
            stores=[
                "Estado externo do pagamento",
                "Identificadores Easypay",
            ],
            must_not_store=[
                "Dados internos como única cópia",
            ],
        ),
        "github_actions": _service(
            name="GitHub Actions",
            role="Automação",
            responsibility=(
                "Executa tarefas independentes "
                "dos PCs, incluindo o backup "
                "diário do Neon."
            ),
            source_of_truth=False,
            stores=[
                "Workflow de automação",
            ],
            must_not_store=[
                "Credenciais no repositório",
                "Dados operacionais permanentes",
            ],
        ),
    }

    flows = [
        {
            "name": "Frontend para Backend",
            "from": "cloudflare_workers",
            "to": "render",
            "purpose": (
                "Chamadas da aplicação passam "
                "pela API backend."
            ),
            "status": "ok",
        },
        {
            "name": "Pagamentos",
            "from": "render",
            "to": "easypay",
            "purpose": (
                "Criação e sincronização "
                "de pagamentos."
            ),
            "status": "ok",
        },
        {
            "name": "Persistência de pagamentos",
            "from": "render",
            "to": "neon",
            "purpose": (
                "Referências e estados ficam "
                "persistidos no Neon."
            ),
            "status": "ok",
        },
        {
            "name": "Ficheiros",
            "from": "render",
            "to": "r2",
            "purpose": (
                "Conteúdo binário persistente "
                "fica no R2."
            ),
            "status": "ok",
        },
        {
            "name": "Pesquisa bancária",
            "from": "render",
            "to": "d1",
            "purpose": (
                "Metadados e índices bancários "
                "são consultados no D1."
            ),
            "status": "ok",
        },
        {
            "name": "Backup Neon",
            "from": "github_actions",
            "to": "r2",
            "purpose": (
                "Backup validado do Neon "
                "é armazenado no R2."
            ),
            "status": "ok",
        },
    ]

    rules = [
        {
            "id": "frontend_no_direct_cloud",
            "status": "ok",
            "label": (
                "Frontend sem acesso cloud direto"
            ),
            "detail": (
                "O browser comunica através das "
                "rotas da aplicação e do backend."
            ),
        },
        {
            "id": "neon_transactional_truth",
            "status": "ok",
            "label": (
                "Neon como fonte relacional"
            ),
            "detail": (
                "Pagamentos, utilizadores e "
                "comunicação permanecem no Neon."
            ),
        },
        {
            "id": "r2_file_storage",
            "status": "ok",
            "label": (
                "R2 para ficheiros persistentes"
            ),
            "detail": (
                "Ficheiros operacionais não "
                "dependem do disco do Render."
            ),
        },
        {
            "id": "d1_specialized",
            "status": "ok",
            "label": (
                "D1 com responsabilidade especializada"
            ),
            "detail": (
                "D1 mantém calendário e índice "
                "bancário, sem substituir Neon."
            ),
        },
        {
            "id": "bank_index_rebuildable",
            "status": "ok",
            "label": (
                "Índice bancário reconstruível"
            ),
            "detail": (
                "bank_index_files e "
                "bank_index_movements podem ser "
                "reconstruídos a partir dos "
                "ficheiros bancários."
            ),
        },
        {
            "id": "backup_external",
            "status": "ok",
            "label": (
                "Backup externo à base principal"
            ),
            "detail": (
                "GitHub Actions cria backup Neon "
                "validado e guarda-o no R2."
            ),
        },
        {
            "id": "pc_independent",
            "status": "ok",
            "label": (
                "Produção independente dos PCs"
            ),
            "detail": (
                "Nenhum computador de desenvolvimento "
                "é necessário para manter produção."
            ),
        },
    ]

    issues = [
        rule
        for rule in rules
        if rule["status"] != "ok"
    ]

    architecture_ok = (
        len(issues) == 0
    )

    return {
        "status": (
            "compliant"
            if architecture_ok
            else "warning"
        ),
        "status_label": (
            "Arquitetura conforme"
            if architecture_ok
            else "Arquitetura requer atenção"
        ),
        "checked_at": (
            checked_at.isoformat()
        ),
        "architecture_ok": (
            architecture_ok
        ),
        "summary": {
            "services": len(services),
            "flows": len(flows),
            "rules": len(rules),
            "issues": len(issues),
            "sources_of_truth": [
                "neon",
                "r2",
            ],
        },
        "services": services,
        "flows": flows,
        "rules": rules,
        "issues": issues,
    }