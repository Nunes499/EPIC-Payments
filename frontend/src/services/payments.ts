import {
  getToken,
} from "@/services/auth";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


export type PaymentStatus =
  | "pending"
  | "paid"
  | "expired"
  | "failed"
  | "active"
  | "authorised"
  | "error"
  | "deleted"
  | "voided";


export type PaymentReferenceItem = {
  id: number;
  member_number: string;
  member_name: string;
  value: number;
  entity: string;
  reference: string;
  easypay_id: string;
  payment_status: string;
  display_status: string;
  expires_at: string | null;
  paid_at: string | null;
  created_by_name: string;
  created_at: string;
  checked_at: string | null;
};


export type PaymentRefreshSummary = {
  checked: number;
  updated: number;
  failed: number;
};


function requireToken(): string {
  const token =
    getToken();

  if (!token) {
    throw new Error(
      "Sessão não encontrada. Inicie sessão novamente.",
    );
  }

  return token;
}


async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      await response.json();

    if (
      data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    // Ignorar corpo inválido.
  }

  return fallback;
}


export async function getPayments(
  statusFilter = "all",
  search = "",
): Promise<
  PaymentReferenceItem[]
> {
  const token =
    requireToken();

  const params =
    new URLSearchParams({
      status_filter:
        statusFilter,
      search,
      limit: "500",
    });

  const response =
    await fetch(
      `${API_URL}/payments?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível carregar os pagamentos.",
      ),
    );
  }

  return response.json();
}


export async function refreshPayment(
  paymentId: number,
): Promise<
  PaymentReferenceItem
> {
  const token =
    requireToken();

  const response =
    await fetch(
      `${API_URL}/payments/${paymentId}/refresh`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível atualizar este pagamento.",
      ),
    );
  }

  return response.json();
}


export async function refreshPendingPayments():
Promise<PaymentRefreshSummary> {
  const token =
    requireToken();

  const response =
    await fetch(
      `${API_URL}/payments/refresh-pending`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível atualizar os estados Easypay.",
      ),
    );
  }

  return response.json();
}
