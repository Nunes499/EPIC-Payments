import { getToken } from "@/services/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";

export type SmsMessageType =
  | "informative"
  | "returned";

export type MultibancoReferenceRequest = {
  member_number: string;
  member_name: string;
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

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();

    if (
      data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    // Ignorar erro de leitura do corpo.
  }

  return fallback;
}

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Sessão não encontrada. Inicie sessão novamente.",
    );
  }

  return token;
}

export async function createMultibancoReference(
  payload: MultibancoReferenceRequest,
): Promise<MultibancoReferenceResponse> {
  const token = requireToken();

  const response = await fetch(
    `${API_URL}/communication/multibanco-reference`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
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
  payload: CommunicationSmsRequest,
): Promise<CommunicationSmsResponse> {
  const token = requireToken();

  const response = await fetch(
    `${API_URL}/communication/sms`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
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
  payload: CommunicationReportRequest,
): Promise<CommunicationReportResponse> {
  const token = requireToken();

  const response = await fetch(
    `${API_URL}/communication/report`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
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
  const token = requireToken();

  const params =
    new URLSearchParams({
      source,
      limit: String(limit),
    });

  const response = await fetch(
    `${API_URL}/communication/sms-history?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
