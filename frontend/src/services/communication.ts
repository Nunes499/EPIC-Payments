import { getToken } from "@/services/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";

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

async function getErrorMessage(
  response: Response,
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

  return (
    "Não foi possível criar a referência " +
    "Multibanco."
  );
}

export async function createMultibancoReference(
  payload: MultibancoReferenceRequest,
): Promise<MultibancoReferenceResponse> {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Sessão não encontrada. Inicie sessão novamente.",
    );
  }

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
      await getErrorMessage(response),
    );
  }

  return response.json();
}
