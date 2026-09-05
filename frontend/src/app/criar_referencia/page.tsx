"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  BatteryFull,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  MessageSquareText,
  Mic,
  Plus,
  RefreshCw,
  Send,
  Signal,
  Video,
  Wifi,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";

import {
  createMultibancoReference,
  getSmsHistory,
  sendCommunicationSms,
  type MultibancoReferenceResponse,
  type SmsHistoryItem,
  type SmsMessageType,
} from "@/services/communication";

import styles from "./page.module.css";

const MESSAGE_LABELS: Record<SmsMessageType, string> = {
  informative: "1 - Informativa",
  returned: "2 - Débito não processado",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatReference(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return value;
  }

  return digits.match(/.{1,3}/g)?.join(" ") ?? digits;
}

function buildPreviewMessage(
  type: SmsMessageType,
  entity: string,
  reference: string,
  value: number | null,
): string {
  const entityText = entity || "-----";
  const referenceText = reference
    ? formatReference(reference)
    : "--- --- ---";

  const valueText =
    value && value > 0 ? formatCurrency(value) : "--,-- €";

  if (type === "informative") {
    return [
      "Estimado cliente,",
      "Seguem os dados para pagamento:",
      `Ent:${entityText}`,
      `Ref:${referenceText}`,
      `Valor: ${valueText}`,
      "EPIC FITNESS",
    ].join("\n");
  }

  return [
    "Estimado cliente,",
    "Nao foi possivel processar a sua cobranca por debito direto.",
    "Efetue o pagamento por:",
    `Ent:${entityText}`,
    `Ref:${referenceText}`,
    `Valor: ${valueText}`,
    "EPIC FITNESS",
  ].join("\n");
}

export default function CriarReferenciaPage() {
  const [memberNumber, setMemberNumber] = useState("");
  const [memberName, setMemberName] = useState("");
  const [phone, setPhone] = useState("");
  const [value, setValue] = useState("");
  const [messageType, setMessageType] =
    useState<SmsMessageType>("informative");

  const [referenceData, setReferenceData] =
    useState<MultibancoReferenceResponse | null>(null);

  const [creatingReference, setCreatingReference] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [smsHistory, setSmsHistory] = useState<SmsHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const numericValue = useMemo(() => {
    const parsed = Number(
      value.replace(/\s/g, "").replace(",", "."),
    );

    return Number.isFinite(parsed) ? parsed : null;
  }, [value]);

  const previewMessage = useMemo(
    () =>
      buildPreviewMessage(
        messageType,
        referenceData?.entity ?? "",
        referenceData?.reference ?? "",
        referenceData?.value ?? numericValue,
      ),
    [messageType, referenceData, numericValue],
  );

  const canCreate =
    Boolean(memberNumber.trim()) &&
    Boolean(memberName.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(numericValue && numericValue > 0) &&
    !creatingReference &&
    !referenceData;

  const canSendSms =
    Boolean(referenceData) &&
    Boolean(phone.trim()) &&
    !sendingSms &&
    !smsSent;

  async function loadSmsHistory() {
    try {
      setLoadingHistory(true);

      const items = await getSmsHistory("create_reference", 10);
      setSmsHistory(items);
    } catch (error) {
      console.error("Erro ao carregar histórico de SMS:", error);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    void loadSmsHistory();
  }, []);

  async function handleCreateReference(event: FormEvent) {
    event.preventDefault();

    if (!canCreate) {
      setFeedback(
        "Preencha todos os campos obrigatórios antes de criar a referência.",
      );
      return;
    }

    try {
      setCreatingReference(true);
      setFeedback("");

      const result = await createMultibancoReference({
        member_number: memberNumber.trim(),
        member_name: memberName.trim(),
        value: numericValue as number,
      });

      setReferenceData(result);

      setFeedback(
        "Referência criada com sucesso. Confirme a mensagem e envie o SMS.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a referência.",
      );
    } finally {
      setCreatingReference(false);
    }
  }

  async function handleSendSms() {
    if (!referenceData || !canSendSms) {
      return;
    }

    try {
      setSendingSms(true);
      setFeedback("");

      await sendCommunicationSms({
        phone: phone.trim(),
        entity: referenceData.entity,
        reference: referenceData.reference,
        value: referenceData.value,
        message_type: messageType,
        source: "create_reference",
        member_number: memberNumber.trim(),
        member_name: memberName.trim(),
      });

      setSmsSent(true);
      await loadSmsHistory();

      setFeedback("SMS enviado com sucesso.");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o SMS.",
      );
    } finally {
      setSendingSms(false);
    }
  }

  function handleNewReference() {
    setMemberNumber("");
    setMemberName("");
    setPhone("");
    setValue("");
    setMessageType("informative");
    setReferenceData(null);
    setSmsSent(false);
    setFeedback("");
  }

  return (
    <AppLayout hideHeader>
      <main className={styles.page}>
        <section className={styles.heading}>
          <div>
            <span className={styles.kicker}>PAGAMENTO INDIVIDUAL</span>

            <h1>Criar Referência</h1>

            <p>
              Crie uma referência Multibanco individual e envie os dados de
              pagamento por SMS.
            </p>
          </div>

          <div className={styles.headingIcon} aria-hidden="true">
            <CreditCard size={25} strokeWidth={2} />
          </div>
        </section>

        <div className={styles.workspace}>
          <section className={styles.formCard}>
            <form onSubmit={handleCreateReference} className={styles.form}>
              <div className={styles.sectionTitle}>
                <div>
                  <span>DADOS DO CLIENTE</span>
                  <h2>Criar pagamento</h2>
                </div>
              </div>

              <div className={styles.fieldsGrid}>
                <label className={styles.field}>
                  <span>Nº Sócio</span>
                  <input
                    value={memberNumber}
                    onChange={(event) =>
                      setMemberNumber(event.target.value)
                    }
                    disabled={Boolean(referenceData)}
                    placeholder="Ex.: 205284"
                    maxLength={50}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span>Nome</span>
                  <input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    disabled={Boolean(referenceData)}
                    placeholder="Nome do cliente"
                    maxLength={200}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span>Telemóvel</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Ex.: 919 279 106"
                    maxLength={40}
                    inputMode="tel"
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span>Valor</span>

                  <div className={styles.valueField}>
                    <input
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      disabled={Boolean(referenceData)}
                      placeholder="44,90"
                      inputMode="decimal"
                      required
                    />
                    <strong>€</strong>
                  </div>
                </label>
              </div>

              <div className={styles.messageChoice}>
                <div className={styles.messageChoiceHeader}>
                  <MessageSquareText size={20} strokeWidth={2.1} />

                  <div>
                    <strong>Tipo de mensagem</strong>
                    <small>
                      Escolha o texto antes de criar a referência.
                    </small>
                  </div>
                </div>

                <div className={styles.messageOptions}>
                  <button
                    type="button"
                    className={`${styles.messageOption} ${
                      messageType === "informative"
                        ? styles.messageOptionActive
                        : ""
                    }`}
                    onClick={() => setMessageType("informative")}
                  >
                    <span className={styles.radio} />

                    <span>
                      <strong>1 - Informativa</strong>
                      <small>
                        Envia apenas os dados necessários para pagamento.
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.messageOption} ${
                      messageType === "returned"
                        ? styles.messageOptionActive
                        : ""
                    }`}
                    onClick={() => setMessageType("returned")}
                  >
                    <span className={styles.radio} />

                    <span>
                      <strong>2 - Débito não processado</strong>
                      <small>
                        Utiliza a mensagem já aplicada nos débitos devolvidos.
                      </small>
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={styles.createButton}
                disabled={!canCreate}
              >
                {creatingReference
                  ? "A criar referência..."
                  : "Criar referência"}
              </button>
            </form>

            <div className={styles.referenceSide}>
              <div className={styles.referencePanel}>
                <div className={styles.referenceHeader}>
                  <div>
                    <span>REFERÊNCIA MULTIBANCO</span>
                    <h3>
                      {referenceData
                        ? "Referência criada"
                        : "A aguardar criação"}
                    </h3>
                  </div>

                  {referenceData && (
                    <CheckCircle2 size={24} strokeWidth={2.2} />
                  )}
                </div>

                <div className={styles.referenceRows}>
                  <ReferenceRow
                    label="Entidade"
                    value={referenceData?.entity ?? "—"}
                  />

                  <ReferenceRow
                    label="Referência"
                    value={
                      referenceData
                        ? formatReference(referenceData.reference)
                        : "—"
                    }
                  />

                  <ReferenceRow
                    label="Valor"
                    value={
                      referenceData
                        ? formatCurrency(referenceData.value)
                        : numericValue && numericValue > 0
                          ? formatCurrency(numericValue)
                          : "—"
                    }
                  />

                  <ReferenceRow
                    label="Validade"
                    value={referenceData?.expires_at ?? "—"}
                  />
                </div>

                {referenceData && (
                  <button
                    type="button"
                    className={styles.newButton}
                    onClick={handleNewReference}
                  >
                    <RefreshCw size={15} />
                    Nova referência
                  </button>
                )}
              </div>

              <button
                type="button"
                className={styles.smsButton}
                disabled={!canSendSms}
                onClick={handleSendSms}
              >
                {smsSent ? (
                  <>
                    <CheckCircle2 size={18} />
                    SMS enviado
                  </>
                ) : sendingSms ? (
                  "A enviar SMS..."
                ) : (
                  <>
                    <Send size={17} />
                    Enviar SMS
                  </>
                )}
              </button>

              {!referenceData && (
                <p className={styles.referenceHint}>
                  Crie primeiro a referência para ativar o envio do SMS.
                </p>
              )}

              {feedback && (
                <div
                  className={`${styles.feedback} ${
                    feedback.toLowerCase().includes("sucesso")
                      ? styles.feedbackSuccess
                      : styles.feedbackError
                  }`}
                >
                  {feedback}
                </div>
              )}
            </div>
          </section>

          <section className={styles.phoneColumn}>
            <div className={styles.phoneStage}>
              <span className={styles.stageGlowOne} />
              <span className={styles.stageGlowTwo} />

              <div className={styles.phone}>
                <span className={styles.sideButtonLeftTop} />
                <span className={styles.sideButtonLeftMiddle} />
                <span className={styles.sideButtonLeftBottom} />
                <span className={styles.sideButtonRight} />

                <div className={styles.phoneBezel}>
                  <div className={styles.phoneScreen}>
                    <div className={styles.statusBar}>
                      <strong>09:41</strong>

                      <div className={styles.dynamicIsland}>
                        <span className={styles.islandCamera} />
                      </div>

                      <div className={styles.statusIcons}>
                        <Signal size={14} strokeWidth={2.7} />
                        <Wifi size={15} strokeWidth={2.5} />
                        <BatteryFull size={19} strokeWidth={2.2} />
                      </div>
                    </div>

                    <div className={styles.iosHeader}>
                      <button
                        type="button"
                        className={styles.iosHeaderAction}
                        aria-label="Voltar"
                        tabIndex={-1}
                      >
                        <ChevronLeft size={28} strokeWidth={2.1} />
                      </button>

                      <div className={styles.iosContact}>
                        <div className={styles.contactAvatar}>E</div>
                        <strong>EpicFitness</strong>
                        <span>›</span>
                      </div>

                      <button
                        type="button"
                        className={styles.iosHeaderAction}
                        aria-label="Vídeo"
                        tabIndex={-1}
                      >
                        <Video size={21} strokeWidth={1.9} />
                      </button>
                    </div>

                    <div className={styles.conversationMeta}>
                      <span>Mensagem de texto</span>
                      <strong>Hoje, 09:41</strong>
                    </div>

                    <div className={styles.conversation}>
                      <div className={styles.messageBubble}>
                        {previewMessage}
                      </div>
                    </div>

                    <div className={styles.iosComposer}>
                      <button
                        type="button"
                        className={styles.composerPlus}
                        tabIndex={-1}
                        aria-label="Adicionar"
                      >
                        <Plus size={23} strokeWidth={1.9} />
                      </button>

                      <div className={styles.composerInput}>
                        <span>Mensagem de texto</span>
                        <Mic size={17} strokeWidth={2} />
                      </div>
                    </div>

                    <div className={styles.homeIndicator} />
                  </div>
                </div>
              </div>
            </div>


          </section>
        </div>

        <section className={styles.historySection}>
          <div className={styles.historyHeader}>
            <div>
              <span>HISTÓRICO PERMANENTE</span>
              <h2>Últimos 10 SMS enviados</h2>
            </div>

            <small>Registado no sistema</small>
          </div>

          {loadingHistory ? (
            <div className={styles.historyEmpty}>
              A carregar histórico...
            </div>
          ) : smsHistory.length === 0 ? (
            <div className={styles.historyEmpty}>
              Ainda não existem SMS registados nesta função.
            </div>
          ) : (
            <div className={styles.historyGrid}>
              {smsHistory.map((item) => (
                <article key={item.id} className={styles.historyCard}>
                  <div className={styles.historyCardTop}>
                    <div className={styles.historyIcon}>
                      <Send size={15} />
                    </div>

                    <span className={styles.historyStatus}>Enviado</span>
                  </div>

                  <strong className={styles.historyName}>
                    {item.member_name || "Cliente"}
                  </strong>

                  <span className={styles.historyMember}>
                    Sócio {item.member_number || "—"}
                  </span>

                  <div className={styles.historyDetails}>
                    <span>{item.phone}</span>
                    <span>{formatCurrency(item.value)}</span>
                    <span>Ent. {item.entity}</span>
                    <span>Ref. {formatReference(item.reference)}</span>
                  </div>

                  <div className={styles.historyMessageType}>
                    {MESSAGE_LABELS[item.message_type]}
                  </div>

                  <div className={styles.historyFooter}>
                    <time>
                      {new Date(item.sent_at).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>

                    <strong>Enviado por: {item.sent_by_name}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  );
}

function ReferenceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.referenceRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
