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


const LEGACY_TOKEN_KEY =
  "epic_payments_access_token";

/*
 * Valor de compatibilidade temporário.
 *
 * O JWT verdadeiro já não é exposto ao
 * JavaScript. Mantemos estas funções até
 * terminarmos de atualizar os restantes
 * services que ainda importam getToken().
 */
const COOKIE_SESSION_MARKER =
  "__epic_http_only_session__";


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
          },
        );

      /*
       * Token inválido/expirado:
       * deixa de fazer sentido mantê-lo
       * no browser.
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
       * Só apagamos o JWT antigo depois
       * de o Worker confirmar que o cookie
       * HttpOnly foi criado.
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


/*
 * =====================================================
 * COMPATIBILIDADE TEMPORÁRIA
 * =====================================================
 *
 * Estas três funções continuam exportadas
 * apenas porque alguns services antigos
 * ainda as importam.
 *
 * Nenhuma delas devolve o JWT verdadeiro.
 */
export function getToken():
string | null {
  return COOKIE_SESSION_MARKER;
}


export function setToken(
  _token: string,
): void {
  clearLegacyToken();
}


export function clearToken():
void {
  clearLegacyToken();
}


export function isTokenExpired(
  token: string,
): boolean {
  return (
    token !==
    COOKIE_SESSION_MARKER
  );
}


export function getValidToken():
string | null {
  return COOKIE_SESSION_MARKER;
}


/*
 * =====================================================
 * AUTENTICAÇÃO VIA COOKIE HTTPONLY
 * =====================================================
 */

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
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
   * Mantemos o formato antigo apenas
   * enquanto o AuthProvider ainda espera
   * access_token.
   *
   * Isto NÃO é um JWT.
   */
  return {
    access_token:
      COOKIE_SESSION_MARKER,
    token_type:
      "cookie",
  };
}


export async function getCurrentUser(
  _token?: string,
): Promise<AuthUser> {
  /*
   * Se este browser ainda tiver o JWT da
   * versão anterior, convertemo-lo primeiro
   * para o novo cookie HttpOnly.
   */
  await migrateLegacySession();

  const response =
    await fetch(
      "/api/backend/auth/me",
      {
        method: "GET",
        cache:
          "no-store",
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
