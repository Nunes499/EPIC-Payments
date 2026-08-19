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
    throw new Error(
      await parseError(response),
    );
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
    throw new Error(
      await parseError(response),
    );
  }

  return response.json();
}


export async function uploadCalendarFile(
  calendarDate: string,
  file: File,
): Promise<ApiCalendarFile> {
  const formData = new FormData();

  formData.append(
    "upload",
    file,
  );

  const response = await fetch(
    `${API_URL}/files/calendar/${calendarDate}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response),
    );
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
    throw new Error(
      await parseError(response),
    );
  }
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
    throw new Error(
      await parseError(response),
    );
  }

  const blob = await response.blob();

  const objectUrl =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = objectUrl;
  anchor.download =
    file.original_filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    objectUrl,
  );
}


export async function previewCalendarFile(
  file: ApiCalendarFile,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/files/${file.id}/download`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response),
    );
  }

  const blob =
    await response.blob();

  const objectUrl =
    URL.createObjectURL(blob);

  const previewWindow =
    window.open(
      objectUrl,
      "_blank",
      "noopener,noreferrer",
    );

  if (!previewWindow) {
    URL.revokeObjectURL(
      objectUrl,
    );

    throw new Error(
      "O navegador bloqueou a janela de pré-visualização.",
    );
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(
      objectUrl,
    );
  }, 60_000);
}