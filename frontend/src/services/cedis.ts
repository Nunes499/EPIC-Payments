export type ApiCedisFile = {
  id: number;
  original_filename: string;
  stored_filename: string;
  mime_type: string | null;
  file_size: number | null;
  file_path: string;
  is_active: boolean;
  uploaded_by_id: number | null;
  uploaded_at: string;
};

export type ApiCedisPreviewRow = {
  member_number: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  birth_year: number | null;
  age: number | null;
};

export type ApiCedisPreviewResponse = {
  file: ApiCedisFile;
  total_rows: number;
  preview_rows: ApiCedisPreviewRow[];
  columns: string[];
};


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";


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


export async function getActiveCedisFile(): Promise<
  ApiCedisFile | null
> {
  const response = await fetch(
    `${API_URL}/cedis/active`,
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


export async function getCedisHistory(): Promise<
  ApiCedisFile[]
> {
  const response = await fetch(
    `${API_URL}/cedis/history`,
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


export async function uploadCedisFile(
  file: File,
): Promise<ApiCedisFile> {
  const formData = new FormData();

  formData.append(
    "upload",
    file,
  );

  const response = await fetch(
    `${API_URL}/cedis/upload`,
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


export async function getCedisPreview(
  fileId: number,
  limit = 100,
): Promise<ApiCedisPreviewResponse> {
  const response = await fetch(
    `${API_URL}/cedis/${fileId}/preview?limit=${limit}`,
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


export async function downloadCedisFile(
  file: ApiCedisFile,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/cedis/${file.id}/download`,
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
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement("a");

  anchor.href =
    objectUrl;

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