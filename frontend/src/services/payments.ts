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


export type PaymentCreationStatus =
  | "creating"
  | "created"
  | "creation_failed"
  | "creation_unknown";


export type PaymentReferenceItem = {
  id: number;

  member_number: string;
  member_name: string;

  value: number;

  entity: string | null;
  reference: string | null;
  easypay_id: string | null;

  operation_key: string;

  creation_status:
    PaymentCreationStatus;

  creation_error:
    string | null;

  creation_checked_at:
    string | null;

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
  const params =
    new URLSearchParams({
      status_filter:
        statusFilter,

      search,

      limit: "500",
    });

  const response =
    await fetch(
      `/api/backend/payments?${params.toString()}`,
      {
        method: "GET",
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
  const response =
    await fetch(
      `/api/backend/payments/${paymentId}/refresh`,
      {
        method: "POST",
        cache: "no-store",
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
  const response =
    await fetch(
      "/api/backend/payments/refresh-pending",
      {
        method: "POST",
        cache: "no-store",
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
