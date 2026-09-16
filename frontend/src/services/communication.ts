export type SmsMessageType =
  | "informative"
  | "returned";


export type MultibancoReferenceRequest = {
  member_number: string;
  member_name: string;
  phone: string;
  value: number;
};


export type MultibancoReferenceResponse = {
  status: string;
  entity: string;
  reference: string;
  value: number;
  expires_at: string;
  easypay_id: string;
  idempotency_key: string;
  payment_reference_id: number;
};


export type CommunicationSmsRequest = {
  phone: string;
  entity: string;
  reference: string;
  value: number;
  message_type?: SmsMessageType;
  source?:
    | "communication"
    | "create_reference";
  member_number?: string;
  member_name?: string;
};


export type SmsHistoryItem = {
  id: number;
  source: string;
  member_number: string;
  member_name: string;
  phone: string;
  entity: string;
  reference: string;
  value: number;
  message_type: SmsMessageType;
  message: string;
  sms_id: string;
  sent_by_id: number | null;
  sent_by_name: string;
  sent_at: string;
};


export type CommunicationSmsResponse = {
  status: "sent";
  sms_id: string;
  phone: string;
  message: string;
  sms_history_id: number;
};


export type CommunicationReportRow = {
  member_number: string;
  name: string;
  phone: string;
  value: number;
  entity: string;
  reference: string;
  sms_status:
    | "pending"
    | "sent"
    | "failed";
  reason: string;
};


export type CommunicationReportRequest = {
  calendar_date: string;
  source_file_id: number | null;
  source_filename: string;
  cedis_filename: string;
  rows: CommunicationReportRow[];
};


export type CommunicationReportResponse = {
  id: number;
  calendar_date: string;
  original_filename: string;
  stored_filename: string;
  file_type: "report";
  file_category: string;
  recovery_part: null;
  related_file_id: number | null;
  mime_type: string | null;
  file_size: number | null;
  file_path: string;
  uploaded_at: string;
};


export type CommunicationRowState = {
  source_file_id: number;
  sequence: number;
  member_number: string;
  member_name: string;
  age: number | null;
  phone: string;
  amount: string;
  reason: string;

  payment_reference_id:
    number | null;

  entity: string;
  reference: string;
  reference_expires_at: string;
  easypay_id: string;

  sms_history_id:
    number | null;

  sms_status:
    | "pending"
    | "sent";

  sms_id: string;

  updated_at: string;
};


export type CommunicationRowStateUpdate = {
  member_number?: string | null;
  member_name?: string | null;
  age?: number | null;
  phone?: string | null;
  amount?: string | null;
  reason?: string | null;
  payment_reference_id?:
    number | null;
  sms_history_id?:
    number | null;

  // Compatibilidade temporária para migrar o estado antigo
  // do localStorage para os registos oficiais do Neon.
  easypay_id?: string | null;
  sms_id?: string | null;
};


async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      await response.json();

    if (
      data &&
      typeof data.detail ===
        "string"
    ) {
      return data.detail;
    }
  } catch {
    // Ignorar erro de leitura do corpo.
  }

  return fallback;
}


export async function createMultibancoReference(
  payload:
    MultibancoReferenceRequest,
): Promise<
  MultibancoReferenceResponse
> {
  const response =
    await fetch(
      "/api/backend/communication/multibanco-reference",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(
            payload,
          ),
        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível criar a referência Multibanco.",
      ),
    );
  }

  return response.json();
}


export async function sendCommunicationSms(
  payload:
    CommunicationSmsRequest,
): Promise<
  CommunicationSmsResponse
> {
  const response =
    await fetch(
      "/api/backend/communication/sms",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(
            payload,
          ),
        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível enviar o SMS.",
      ),
    );
  }

  return response.json();
}


export async function attachCommunicationReport(
  payload:
    CommunicationReportRequest,
): Promise<
  CommunicationReportResponse
> {
  const response =
    await fetch(
      "/api/backend/communication/report",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(
            payload,
          ),
        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível anexar o relatório ao calendário.",
      ),
    );
  }

  return response.json();
}


export async function getSmsHistory(
  source:
    | "communication"
    | "create_reference" =
      "create_reference",
  limit = 10,
): Promise<SmsHistoryItem[]> {
  const params =
    new URLSearchParams({
      source,
      limit:
        String(limit),
    });

  const response =
    await fetch(
      `/api/backend/communication/sms-history?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível carregar o histórico de SMS.",
      ),
    );
  }

  return response.json();
}


export async function getCommunicationRows(
  sourceFileId: number,
): Promise<
  CommunicationRowState[]
> {
  const response =
    await fetch(
      `/api/backend/communication/rows/${sourceFileId}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível carregar o estado da Comunicação.",
      ),
    );
  }

  return response.json();
}


export async function saveCommunicationRow(
  sourceFileId: number,
  sequence: number,
  payload:
    CommunicationRowStateUpdate,
): Promise<CommunicationRowState> {
  const response =
    await fetch(
      `/api/backend/communication/rows/${sourceFileId}/${sequence}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(
            payload,
          ),
        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível guardar o estado da Comunicação.",
      ),
    );
  }

  return response.json();
}
