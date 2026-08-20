export type ApiCalendarFile = {
  id: number;
  calendar_date: string;
  original_filename: string;
  stored_filename: string;
  file_type: "pdf" | "xml" | "report";
  mime_type: string | null;
  file_size: number | null;
  file_path: string;
  uploaded_at: string;
};

export type ApiCalendarDaySummary = {
  calendar_date: string;
  total_files: number;
  pdf_count: number;
  xml_count: number;
  report_count: number;
};

export type ApiBankMovement = {
  sequence: number;
  original_member_reference: string;
  member_number: string;
  name: string;
  amount: string;
  reason_code: string;
  collection_date: string | null;
  bank_reference: string | null;
};

export type ApiBankFileProcessing = {
  file_id: number;
  filename: string;
  file_type: string;
  message_id: string | null;
  original_message_id: string | null;
  declared_transactions: number | null;
  declared_total_amount: string | null;
  parsed_transactions: number;
  parsed_total_amount: string;
  movements: ApiBankMovement[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parseError(
  response: Response,
): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data.detail === "string") {
      return data.detail;
    }

    return "Ocorreu um erro ao comunicar com o servidor.";
  } catch {
    return "Ocorreu um erro ao comunicar com o servidor.";
  }
}

export async function listCalendarFiles(
  calendarDate: string,
): Promise<ApiCalendarFile[]> {
  const response = await fetch(
    `${API_URL}/files/calendar/${calendarDate}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function listYearSummary(
  year: number,
): Promise<ApiCalendarDaySummary[]> {
  const response = await fetch(
    `${API_URL}/files/year/${year}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function uploadCalendarFile(
  calendarDate: string,
  file: File,
): Promise<ApiCalendarFile> {
  const formData = new FormData();

  formData.append("upload", file);

  const response = await fetch(
    `${API_URL}/files/calendar/${calendarDate}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function deleteCalendarFile(
  fileId: number,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/files/${fileId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function processCalendarFile(
  fileId: number,
): Promise<ApiBankFileProcessing> {
  const response = await fetch(
    `${API_URL}/files/${fileId}/process`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function downloadCalendarFile(
  file: ApiCalendarFile,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/files/${file.id}/download`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = file.original_filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}

export async function previewCalendarFile(
  file: ApiCalendarFile,
): Promise<void> {
  const previewWindow =
    window.open(
      "",
      "_blank",
    );

  if (!previewWindow) {
    throw new Error(
      "O navegador bloqueou a janela de pré-visualização.",
    );
  }

  previewWindow.opener = null;

  previewWindow.document.write(`
    <!doctype html>
    <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <title>A carregar ficheiro...</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            color: #111111;
          }

          .loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 12px;
          }

          .brand {
            color: #ef2733;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.12em;
          }

          .message {
            font-size: 16px;
            font-weight: 700;
          }
        </style>
      </head>

      <body>
        <div class="loading">
          <div class="brand">
            EPIC PAYMENTS
          </div>

          <div class="message">
            A carregar pré-visualização...
          </div>
        </div>
      </body>
    </html>
  `);

  previewWindow.document.close();

  try {
    const response = await fetch(
      `${API_URL}/files/${file.id}/download`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    previewWindow.location.href = objectUrl;

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 5 * 60 * 1000);
  } catch (error) {
    previewWindow.close();

    throw error;
  }
}
