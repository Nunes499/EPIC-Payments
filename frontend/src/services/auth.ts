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


const LEGACY_TOKEN_KEY =
  "epic_payments_access_token";


let legacyMigrationPromise:
  Promise<void> | null =
    null;


function getLegacyToken():
string | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return window.localStorage.getItem(
    LEGACY_TOKEN_KEY,
  );
}


function clearLegacyToken():
void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.localStorage.removeItem(
    LEGACY_TOKEN_KEY,
  );
}


async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      await response.json();

    return (
      typeof data?.detail ===
      "string"
        ? data.detail
        : fallback
    );
  } catch {
    return fallback;
  }
}


async function migrateLegacySession():
Promise<void> {
  const legacyToken =
    getLegacyToken();

  if (!legacyToken) {
    return;
  }

  if (
    legacyMigrationPromise
  ) {
    return (
      legacyMigrationPromise
    );
  }

  legacyMigrationPromise =
    (async () => {
      const response =
        await fetch(
          "/api/session/migrate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                token:
                  legacyToken,
              }),
            cache:
              "no-store",
            credentials:
              "same-origin",
          },
        );

      /*
       * Se o token antigo já estiver inválido
       * ou expirado, deixa de fazer sentido
       * mantê-lo no browser.
       */
      if (
        response.status === 400 ||
        response.status === 401
      ) {
        clearLegacyToken();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Não foi possível migrar a sessão existente.",
          ),
        );
      }

      /*
       * Só apagamos o JWT antigo depois de
       * o servidor confirmar a criação do
       * novo cookie HttpOnly.
       */
      clearLegacyToken();
    })();

  try {
    await legacyMigrationPromise;
  } finally {
    legacyMigrationPromise =
      null;
  }
}


export async function login(
  username: string,
  password: string,
): Promise<void> {
  const response =
    await fetch(
      "/api/session/login",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            username,
            password,
          }),
        cache:
          "no-store",
        credentials:
          "same-origin",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível iniciar sessão.",
      ),
    );
  }

  /*
   * Um login novo tem prioridade sobre
   * qualquer token antigo que ainda exista
   * no localStorage. Evita que a migração
   * antiga substitua o cookie acabado de
   * criar.
   */
  clearLegacyToken();
}


export async function getCurrentUser():
Promise<AuthUser> {
  /*
   * Compatibilidade de transição:
   * browsers que ainda tenham o JWT da
   * versão anterior convertem-no uma única
   * vez para cookie HttpOnly e apagam-no
   * do localStorage.
   */
  await migrateLegacySession();

  const response =
    await fetch(
      "/api/backend/auth/me",
      {
        method: "GET",
        cache:
          "no-store",
        credentials:
          "same-origin",
      },
    );

  if (!response.ok) {
    if (
      response.status === 401
    ) {
      clearLegacyToken();
    }

    throw new Error(
      await getErrorMessage(
        response,
        response.status === 401
          ? "Sessão não encontrada ou expirada."
          : "Não foi possível obter o utilizador.",
      ),
    );
  }

  return response.json();
}


export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response =
    await fetch(
      "/api/backend/auth/me/password",
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            current_password:
              currentPassword,
            new_password:
              newPassword,
          }),
        cache:
          "no-store",
        credentials:
          "same-origin",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível alterar a password.",
      ),
    );
  }
}


async function getPhotoObjectUrl(
  endpoint: string,
): Promise<string> {
  const response =
    await fetch(
      `/api/backend${endpoint}`,
      {
        method: "GET",
        cache:
          "no-store",
        credentials:
          "same-origin",
      },
    );

  if (
    response.status === 404
  ) {
    return "";
  }

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível carregar a fotografia.",
      ),
    );
  }

  return URL.createObjectURL(
    await response.blob(),
  );
}


export function getMyPhotoObjectUrl():
Promise<string> {
  return getPhotoObjectUrl(
    "/users/me/photo",
  );
}


export function getUserPhotoObjectUrl(
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
    typeof window !==
      "undefined" &&
    url.startsWith(
      "blob:",
    )
  ) {
    URL.revokeObjectURL(
      url,
    );
  }
}


async function uploadPhoto(
  endpoint: string,
  photo: File,
): Promise<void> {
  const formData =
    new FormData();

  formData.append(
    "photo",
    photo,
  );

  const response =
    await fetch(
      `/api/backend${endpoint}`,
      {
        method: "PUT",
        body:
          formData,
        cache:
          "no-store",
        credentials:
          "same-origin",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível alterar a fotografia.",
      ),
    );
  }
}


export function uploadMyPhoto(
  photo: File,
): Promise<void> {
  return uploadPhoto(
    "/users/me/photo",
    photo,
  );
}


export function uploadUserPhoto(
  userId: number,
  photo: File,
): Promise<void> {
  return uploadPhoto(
    `/users/${userId}/photo`,
    photo,
  );
}


export async function resetUserPassword(
  userId: number,
  newPassword: string,
): Promise<void> {
  const response =
    await fetch(
      `/api/backend/users/${userId}/password`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            new_password:
              newPassword,
          }),
        cache:
          "no-store",
        credentials:
          "same-origin",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível alterar a password.",
      ),
    );
  }
}


export function logout():
void {
  clearLegacyToken();

  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  /*
   * keepalive ajuda o pedido a terminar
   * mesmo quando a navegação para /login
   * começa logo a seguir.
   */
  void fetch(
    "/api/session/logout",
    {
      method: "POST",
      cache:
        "no-store",
      credentials:
        "same-origin",
      keepalive:
        true,
    },
  ).finally(
    () => {
      window.location.href =
        "/login";
    },
  );
}
