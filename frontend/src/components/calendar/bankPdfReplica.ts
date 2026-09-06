"use client";

type BankPdfReplicaOptions = {
  generatedBy: string;
  generatedRole: string;
  generatedAt: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function decorateBankPdfReplica(
  document: Document,
  options: BankPdfReplicaOptions,
): Promise<void> {
  const {
    generatedBy,
    generatedRole,
    generatedAt,
  } = options;

  const pages =
    Array.from(
      document.querySelectorAll<HTMLElement>(
        ".bank-page",
      ),
    );

  if (pages.length === 0) {
    return;
  }

  const style =
    document.createElement("style");

  style.setAttribute(
    "data-epic-bank-replica",
    "true",
  );

  style.textContent = `
    /*
     * Personalização EPIC.
     * Tudo é colocado em posição absoluta para não
     * alterar as tabelas nem a paginação bancária.
     */

    .bank-page {
      position: relative !important;
      overflow: hidden !important;
    }

    .epic-replica-overlay {
      position: absolute !important;
      z-index: 40 !important;
      pointer-events: none !important;
      font-family: Arial, Helvetica, sans-serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /*
     * O logo que já existe no PDF deixa de ficar
     * no canto superior direito e passa para o centro,
     * abaixo do primeiro bloco de informação.
     */
    .epic-logo-wrap {
      top: 44.5mm !important;
      right: auto !important;
      left: 50% !important;
      width: 22mm !important;
      height: 8mm !important;
      transform: translateX(-50%) !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 35 !important;
    }

    .epic-logo-wrap img {
      width: 44mm !important;
      max-height: 16mm !important;
      object-fit: contain !important;
      object-position: center center !important;
    }

    /*
     * AVISO - topo esquerdo
     */
    .epic-replica-message {
      top: 2.6mm !important;
      left: 8.2mm !important;
      width: 83mm !important;
      min-height: 9.0mm !important;
      padding: 1.1mm 1.7mm 1.0mm 2.1mm !important;
      border-left: 1.0mm solid #087ac0 !important;
      border-radius: 0 1.5mm 1.5mm 0 !important;
      background:
        linear-gradient(
          135deg,
          rgba(240,249,255,.98),
          rgba(252,254,255,.98)
        ) !important;
      box-shadow:
        0 .45mm 1.5mm rgba(7,73,116,.07) !important;
      color: #17304a !important;
      line-height: 1.08 !important;
    }

    .epic-replica-message-title {
      display: block !important;
      margin-bottom: .3mm !important;
      color: #075d92 !important;
      font-size: 1.8mm !important;
      font-weight: 800 !important;
      letter-spacing: .07em !important;
      text-transform: uppercase !important;
      white-space: nowrap !important;
    }

    .epic-replica-message-text {
      display: block !important;
      color: #536b7e !important;
      font-size: 1.22mm !important;
      font-weight: 600 !important;
      line-height: 1.18 !important;
    }

    /*
     * COLABORADOR - topo direito
     */
    .epic-replica-collaborator {
      top: 2.6mm !important;
      right: 8.2mm !important;
      width: 44mm !important;
      min-height: 9.0mm !important;
      padding: 1.1mm 1.7mm !important;
      border:
        .18mm solid rgba(8,122,192,.25) !important;
      border-radius: 2.0mm !important;
      background:
        linear-gradient(
          145deg,
          rgba(255,255,255,.99),
          rgba(239,249,255,.96)
        ) !important;
      box-shadow:
        0 .5mm 1.6mm rgba(7,73,116,.08) !important;
      color: #17304a !important;
    }

    .epic-replica-collaborator-label {
      display: block !important;
      margin-bottom: .25mm !important;
      color: #087ac0 !important;
      font-size: 1.25mm !important;
      font-weight: 800 !important;
      letter-spacing: .10em !important;
      text-transform: uppercase !important;
    }

    .epic-replica-collaborator-name {
      display: block !important;
      color: #10233d !important;
      font-size: 1.9mm !important;
      font-weight: 800 !important;
      line-height: 1.04 !important;
    }

    .epic-replica-collaborator-meta {
      display: block !important;
      margin-top: .25mm !important;
      color: #6b7f91 !important;
      font-size: 1.22mm !important;
      font-weight: 600 !important;
      line-height: 1.1 !important;
    }

    /*
     * Assinatura visual no rodapé:
     * duas linhas finas + logo EPIC.
     */
    .epic-replica-footer-brand {
      right: 8.8mm !important;
      bottom: 3.2mm !important;
      width: 24mm !important;
      height: 12mm !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: .65mm !important;
      opacity: .95 !important;
    }

    .epic-replica-footer-line {
      display: block !important;
      width: 100% !important;
      height: .18mm !important;
      background: #7a7a7a !important;
    }

    .epic-replica-footer-logo {
      display: block !important;
      width: 18mm !important;
      height: auto !important;
      max-height: 6mm !important;
      object-fit: contain !important;
    }

    /*
     * Mantém a data do relatório visível sem a fazer
     * concorrer com o cartão do colaborador.
     */
    .report-date {
  display: none !important;
}

    @media print {
      .epic-replica-overlay {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  document.head.appendChild(style);

  const firstPage = pages[0];

  /*
   * Aviso.
   */
  const message =
    document.createElement("div");

  message.className =
    "epic-replica-overlay epic-replica-message";

  message.innerHTML = `
    <span class="epic-replica-message-title">
      RÉPLICA DO DOCUMENTO BANCÁRIO
    </span>

    <span class="epic-replica-message-text">
      Documento reconstruído pelo EPIC Payments a partir do
      ficheiro XML disponibilizado pela entidade bancária.
      O conteúdo bancário e a paginação original foram preservados.
    </span>
  `;

  firstPage.appendChild(message);

  /*
   * Colaborador.
   */
  const collaborator =
    document.createElement("div");

  collaborator.className =
    "epic-replica-overlay epic-replica-collaborator";

  collaborator.innerHTML = `
    <span class="epic-replica-collaborator-label">
      Documento gerado por
    </span>

    <strong class="epic-replica-collaborator-name">
      ${escapeHtml(generatedBy)}
    </strong>

    <span class="epic-replica-collaborator-meta">
  ${escapeHtml(generatedAt)}
</span>
  `;

  firstPage.appendChild(collaborator);

  /*
   * Logo de rodapé em todas as páginas.
   * Usa exatamente o mesmo ficheiro de logo já usado
   * pelo PDF bancário reconstruído.
   */
  const logoSource =
    `${window.location.origin}/branding/logo-epic-payments-dark.png`;

  for (const page of pages) {
    const footer =
      document.createElement("div");

    footer.className =
      "epic-replica-overlay epic-replica-footer-brand";

    footer.innerHTML = `
      <span class="epic-replica-footer-line"></span>

      <img
        class="epic-replica-footer-logo"
        src="${logoSource}"
        alt=""
      />

      <span class="epic-replica-footer-line"></span>
    `;

    page.appendChild(footer);
  }
}
