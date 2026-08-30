const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


export type UserRole =
  | "admin"
  | "collaborator";


export type AuthUser = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  has_photo: boolean;
  created_at: string;
  updated_at: string;
};


type LoginResponse = {
  access_token: string;
  token_type: string;
};


const TOKEN_KEY =
  "epic_payments_access_token";


export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(
    TOKEN_KEY,
  );
}


export function setToken(
  token: string,
): void {
  localStorage.setItem(
    TOKEN_KEY,
    token,
  );
}


export function clearToken(): void {
  localStorage.removeItem(
    TOKEN_KEY,
  );
}


export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const formData =
    new URLSearchParams();

  formData.set(
    "username",
    username,
  );

  formData.set(
    "password",
    password,
  );

  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    },
  );

  if (!response.ok) {
    let message =
      "Não foi possível iniciar sessão.";

    try {
      const data =
        await response.json();

      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // Mantém a mensagem padrão.
    }

    throw new Error(message);
  }

  return response.json();
}


export async function getCurrentUser(
  token?: string,
): Promise<AuthUser> {
  const accessToken =
    token ?? getToken();

  if (!accessToken) {
    throw new Error(
      "Sessão não encontrada.",
    );
  }

  const response = await fetch(
    `${API_URL}/auth/me`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }

    throw new Error(
      "Não foi possível obter o utilizador.",
    );
  }

  return response.json();
}


export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Sessão não encontrada.",
    );
  }

  const response = await fetch(
    `${API_URL}/auth/me/password`,
    {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password:
          currentPassword,
        new_password:
          newPassword,
      }),
    },
  );

  if (!response.ok) {
    let message =
      "Não foi possível alterar a password.";

    try {
      const data =
        await response.json();

      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // Mantém a mensagem padrão.
    }

    throw new Error(message);
  }
}


async function getPhotoObjectUrl(
  endpoint: string,
): Promise<string> {
  const token = getToken();

  if (!token) {
    return "";
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return "";
  }

  if (!response.ok) {
    throw new Error(
      "Não foi possível carregar a fotografia.",
    );
  }

  const blob =
    await response.blob();

  return URL.createObjectURL(
    blob,
  );
}


export async function getMyPhotoObjectUrl(): Promise<string> {
  return getPhotoObjectUrl(
    "/users/me/photo",
  );
}


export async function getUserPhotoObjectUrl(
  userId: number,
): Promise<string> {
  return getPhotoObjectUrl(
    `/users/${userId}/photo`,
  );
}


export function revokePhotoObjectUrl(
  url: string,
): void {
  if (
    typeof window !== "undefined" &&
    url.startsWith("blob:")
  ) {
    URL.revokeObjectURL(url);
  }
}


export function logout(): void {
  clearToken();

  if (typeof window !== "undefined") {
    window.location.href =
      "/login";
  }
}