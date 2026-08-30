"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getToken,
  getUserPhotoObjectUrl,
  revokePhotoObjectUrl,
} from "@/services/auth";


type UserItem = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: "admin" | "collaborator";
  is_active: boolean;
  has_photo: boolean;
  created_at: string;
  updated_at: string;
};


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


export default function UtilizadoresPage() {
  const { user } = useAuth();

  const [users, setUsers] =
    useState<UserItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

    const [editingUser, setEditingUser] =
  useState<UserItem | null>(null);

  const [editName, setEditName] =
  useState("");

const [editUsername, setEditUsername] =
  useState("");

const [editEmail, setEditEmail] =
  useState("");

const [editRole, setEditRole] =
  useState<UserItem["role"]>(
    "collaborator",
  );

const [editIsActive, setEditIsActive] =
  useState(true);

  const [savingEdit, setSavingEdit] =
  useState(false);

const [editError, setEditError] =
  useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [createError, setCreateError] =
    useState("");

  const [name, setName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [role, setRole] =
    useState<
      "admin" | "collaborator"
    >("collaborator");

  const [photo, setPhoto] =
    useState<File | null>(null);


  async function loadUsers() {
    const token = getToken();

    if (!token) {
      setError(
        "Sessão não encontrada.",
      );
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/users`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Não foi possível carregar os utilizadores.",
        );
      }

      const data =
        await response.json();

      setUsers(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao carregar utilizadores.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadUsers();
  }, []);


  function resetCreateForm() {
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("collaborator");
    setPhoto(null);
    setCreateError("");
  }


  function closeCreateModal() {
    if (creating) {
      return;
    }

    setShowCreate(false);
    resetCreateForm();
  }


  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const token = getToken();

    if (!token) {
      setCreateError(
        "Sessão não encontrada.",
      );
      return;
    }

    if (!photo) {
      setCreateError(
        "A fotografia do utilizador é obrigatória.",
      );
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const formData =
        new FormData();

      formData.append(
        "name",
        name.trim(),
      );

      formData.append(
        "username",
        username.trim(),
      );

      formData.append(
        "email",
        email.trim(),
      );

      formData.append(
        "password",
        password,
      );

      formData.append(
        "role",
        role,
      );

      formData.append(
        "photo",
        photo,
      );

      const response = await fetch(
        `${API_URL}/users`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        let message =
          "Não foi possível criar o utilizador.";

        try {
          const data =
            await response.json();

          if (
            typeof data?.detail ===
            "string"
          ) {
            message = data.detail;
          }
        } catch {
          // Mantém a mensagem padrão.
        }

        throw new Error(message);
      }

      setShowCreate(false);
      resetCreateForm();

      setLoading(true);
      await loadUsers();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao criar utilizador.";

      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

async function handleSaveEdit() {
  if (!editingUser) {
    return;
  }

  const token = getToken();

  if (!token) {
    setEditError(
      "Sessão não encontrada.",
    );
    return;
  }

  try {
    setSavingEdit(true);
    setEditError("");

    const response = await fetch(
      `${API_URL}/users/${editingUser.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:
            editName.trim(),
          username:
            editUsername.trim(),
          email:
            editEmail.trim(),
          role:
            editRole,
          is_active:
            editIsActive,
        }),
      },
    );

    if (!response.ok) {
      let message =
        "Não foi possível guardar as alterações.";

      try {
        const data =
          await response.json();

        if (
          typeof data?.detail ===
          "string"
        ) {
          message = data.detail;
        }
      } catch {
        // Mantém a mensagem padrão.
      }

      throw new Error(
        message,
      );
    }

    setEditingUser(null);

    setLoading(true);
    await loadUsers();
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Erro ao guardar alterações.";

    setEditError(message);
  } finally {
    setSavingEdit(false);
  }
}

  if (
    user &&
    user.role !== "admin"
  ) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "32px",
          }}
        >
          <h2>
            Acesso reservado
          </h2>

          <p>
            Esta área está disponível
            apenas para Administradores.
          </p>
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <div
        style={{
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "28px",
              }}
            >
              Utilizadores
            </h2>

            <p
              style={{
                marginTop: "6px",
                marginBottom: 0,
                color: "#666",
              }}
            >
              Gestão dos Administradores
              e Colaboradores do sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreate(true);
            }}
            style={{
              border: 0,
              borderRadius: "10px",
              padding: "12px 18px",
              background: "#d71920",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Novo utilizador
          </button>
        </div>


        {loading && (
          <p>
            A carregar utilizadores...
          </p>
        )}


        {error && (
          <div
            style={{
              padding: "14px",
              borderRadius: "10px",
              background: "#fdecec",
              color: "#a40000",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}


        {!loading &&
          !error && (
            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              {users.map(
                (item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "70px 1.4fr 1fr 1.6fr 1fr 110px",
                      alignItems: "center",
                      gap: "16px",
                      padding: "16px",
                      border:
                        "1px solid #e2e2e2",
                      borderRadius:
                        "14px",
                      background: "#fff",
                    }}
                  >
                    <UserAvatar
                      userId={item.id}
                      name={item.name}
                      hasPhoto={
                        item.has_photo
                      }
                    />

                    <div>
                      <strong>
                        {item.name}
                      </strong>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#777",
                          fontSize: "13px",
                        }}
                      >
                        @{item.username}
                      </div>
                    </div>

                    <div>
                      {item.role ===
                      "admin"
                        ? "Administrador"
                        : "Colaborador"}
                    </div>

                    <div>
                      {item.email}
                    </div>

                    <div>
                      <span
                        style={{
                          display:
                            "inline-block",
                          padding:
                            "6px 10px",
                          borderRadius:
                            "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background:
                            item.is_active
                              ? "#e8f7ed"
                              : "#f3f3f3",
                          color:
                            item.is_active
                              ? "#16713a"
                              : "#666",
                        }}
                      >
                        {item.is_active
                          ? "Ativo"
                          : "Inativo"}
                      </span>
                    </div>

                    <button
  type="button"
  onClick={() => {
  setEditingUser(item);
  setEditName(item.name);
  setEditUsername(item.username);
  setEditEmail(item.email);
  setEditRole(item.role);
  setEditIsActive(item.is_active);
}}
  style={{
    border:
      "1px solid #d8d8d8",
    borderRadius: "8px",
    padding: "9px 12px",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  }}
>
  Editar
</button>
                  </div>
                ),
              )}
            </div>
          )}
      </div>

{editingUser && (
  <div
    role="presentation"
    onMouseDown={(event) => {
      if (
        event.target ===
        event.currentTarget
      ) {
        setEditingUser(null);
      }
    }}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background:
        "rgba(0, 0, 0, 0.55)",
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      style={{
        width: "100%",
        maxWidth: "620px",
        borderRadius: "18px",
        background: "#fff",
        boxShadow:
          "0 24px 80px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent:
            "space-between",
          gap: "20px",
          padding:
            "24px 26px 18px",
          borderBottom:
            "1px solid #ededed",
        }}
      >
        <div>
          <div
            style={{
              color: "#d71920",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "1.4px",
              textTransform:
                "uppercase",
              marginBottom: "6px",
            }}
          >
            EPIC Payments
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "25px",
            }}
          >
            Editar utilizador
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#707070",
              fontSize: "14px",
            }}
          >
            {editingUser.name}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingUser(null)
          }
          aria-label="Fechar"
          style={{
            width: "36px",
            height: "36px",
            border:
              "1px solid #ddd",
            borderRadius: "50%",
            background: "#fff",
            fontSize: "21px",
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      <div
  style={{
    padding: "26px",
  }}
>
  <div
    style={{
      display: "grid",
      gap: "18px",
    }}
  >
    <label
      style={{
        display: "grid",
        gap: "7px",
        fontWeight: 700,
        fontSize: "14px",
      }}
    >
      Nome

      <input
        type="text"
        value={editName}
        onChange={(event) =>
          setEditName(
            event.target.value,
          )
        }
        style={inputStyle}
      />
    </label>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 1fr",
        gap: "16px",
      }}
    >
      <label
        style={{
          display: "grid",
          gap: "7px",
          fontWeight: 700,
          fontSize: "14px",
        }}
      >
        Username

        <input
          type="text"
          value={editUsername}
          onChange={(event) =>
            setEditUsername(
              event.target.value,
            )
          }
          style={inputStyle}
        />
      </label>

      <label
        style={{
          display: "grid",
          gap: "7px",
          fontWeight: 700,
          fontSize: "14px",
        }}
      >
        Tipo de utilizador

        <select
          value={editRole}
          onChange={(event) =>
            setEditRole(
              event.target
                .value as UserItem["role"],
            )
          }
          style={inputStyle}
        >
          <option value="collaborator">
            Colaborador
          </option>

          <option value="admin">
            Administrador
          </option>
        </select>
      </label>
    </div>

    <label
      style={{
        display: "grid",
        gap: "7px",
        fontWeight: 700,
        fontSize: "14px",
      }}
    >
      Email

      <input
        type="email"
        value={editEmail}
        onChange={(event) =>
          setEditEmail(
            event.target.value,
          )
        }
        style={inputStyle}
      />
    </label>

    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontWeight: 700,
        fontSize: "14px",
      }}
    >
      <input
        type="checkbox"
        checked={editIsActive}
        onChange={(event) =>
          setEditIsActive(
            event.target.checked,
          )
        }
      />

      Utilizador ativo
    </label>
{editError && (
  <div
    style={{
      padding: "11px 13px",
      borderRadius: "8px",
      background: "#fff1f1",
      color: "#b42318",
      fontSize: "14px",
    }}
  >
    {editError}
  </div>
)}

<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "6px",
  }}
>
  <button
    type="button"
    onClick={() =>
      setEditingUser(null)
    }
    disabled={savingEdit}
    style={{
      border: "1px solid #d8d8d8",
      borderRadius: "8px",
      padding: "11px 18px",
      background: "#fff",
      cursor: "pointer",
      fontWeight: 700,
    }}
  >
    Cancelar
  </button>

  <button
    type="button"
    onClick={handleSaveEdit}
    disabled={savingEdit}
    style={{
      border: 0,
      borderRadius: "8px",
      padding: "11px 18px",
      background: "#d71920",
      color: "#fff",
      cursor: savingEdit
        ? "not-allowed"
        : "pointer",
      fontWeight: 700,
      opacity: savingEdit
        ? 0.7
        : 1,
    }}
  >
    {savingEdit
      ? "A guardar..."
      : "Guardar alterações"}
  </button>
</div>
  </div>
</div>
    </div>
  </div>
)}
          
      
    {showCreate && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background:
              "rgba(0, 0, 0, 0.55)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-user-title"
            style={{
              width: "100%",
              maxWidth: "620px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "18px",
              background: "#fff",
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent:
                  "space-between",
                gap: "20px",
                padding:
                  "24px 26px 18px",
                borderBottom:
                  "1px solid #ededed",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#d71920",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing:
                      "1.4px",
                    textTransform:
                      "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  EPIC Payments
                </div>

                <h2
                  id="new-user-title"
                  style={{
                    margin: 0,
                    fontSize: "25px",
                  }}
                >
                  Novo utilizador
                </h2>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color: "#707070",
                    fontSize: "14px",
                  }}
                >
                  Criar um novo acesso
                  ao sistema.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={creating}
                aria-label="Fechar"
                style={{
                  width: "36px",
                  height: "36px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "50%",
                  background: "#fff",
                  fontSize: "21px",
                  lineHeight: 1,
                  cursor:
                    creating
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ×
              </button>
            </div>


            <form
              onSubmit={handleCreate}
              style={{
                padding: "24px 26px 26px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "18px",
                }}
              >
                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  Fotografia *

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(event) => {
                      setPhoto(
                        event.target
                          .files?.[0] ??
                          null,
                      );
                    }}
                    style={{
                      width: "100%",
                      padding: "11px",
                      border:
                        "1px solid #d8d8d8",
                      borderRadius: "9px",
                      background: "#fff",
                    }}
                  />

                  <span
                    style={{
                      color: "#888",
                      fontSize: "12px",
                      fontWeight: 400,
                    }}
                  >
                    JPG, PNG ou WEBP.
                    Máximo 5 MB.
                  </span>
                </label>


                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  Nome *

                  <input
                    type="text"
                    value={name}
                    required
                    minLength={2}
                    maxLength={120}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    style={inputStyle}
                  />
                </label>


                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "grid",
                      gap: "7px",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    Username *

                    <input
                      type="text"
                      value={username}
                      required
                      minLength={3}
                      maxLength={60}
                      autoCapitalize="none"
                      onChange={(event) =>
                        setUsername(
                          event.target
                            .value,
                        )
                      }
                      style={inputStyle}
                    />
                  </label>


                  <label
                    style={{
                      display: "grid",
                      gap: "7px",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    Tipo de utilizador *

                    <select
                      value={role}
                      onChange={(event) =>
                        setRole(
                          event.target
                            .value as
                            | "admin"
                            | "collaborator",
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="collaborator">
                        Colaborador
                      </option>

                      <option value="admin">
                        Administrador
                      </option>
                    </select>
                  </label>
                </div>


                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  Email *

                  <input
                    type="email"
                    value={email}
                    required
                    onChange={(event) =>
                      setEmail(
                        event.target.value,
                      )
                    }
                    style={inputStyle}
                  />
                </label>


                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  Password *

                  <input
                    type="password"
                    value={password}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    style={inputStyle}
                  />

                  <span
                    style={{
                      color: "#888",
                      fontSize: "12px",
                      fontWeight: 400,
                    }}
                  >
                    Mínimo de 8 caracteres.
                  </span>
                </label>
              </div>


              {createError && (
                <div
                  style={{
                    marginTop: "18px",
                    padding: "12px 14px",
                    borderRadius: "9px",
                    background: "#fdecec",
                    color: "#a40000",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {createError}
                </div>
              )}


              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                  marginTop: "24px",
                  paddingTop: "20px",
                  borderTop:
                    "1px solid #ededed",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeCreateModal
                  }
                  disabled={creating}
                  style={{
                    border:
                      "1px solid #d5d5d5",
                    borderRadius: "9px",
                    padding:
                      "11px 18px",
                    background: "#fff",
                    fontWeight: 700,
                    cursor:
                      creating
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    border: 0,
                    borderRadius: "9px",
                    padding:
                      "11px 20px",
                    background: "#d71920",
                    color: "#fff",
                    fontWeight: 800,
                    cursor:
                      creating
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      creating
                        ? 0.7
                        : 1,
                  }}
                >
                  {creating
                    ? "A criar..."
                    : "Criar utilizador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}


type UserAvatarProps = {
  userId: number;
  name: string;
  hasPhoto: boolean;
};


function UserAvatar({
  userId,
  name,
  hasPhoto,
}: UserAvatarProps) {
  const [photoUrl, setPhotoUrl] =
    useState("");


  useEffect(() => {
    let active = true;
    let objectUrl = "";


    async function loadPhoto() {
      if (!hasPhoto) {
        setPhotoUrl("");
        return;
      }

      try {
        const url =
          await getUserPhotoObjectUrl(
            userId,
          );

        if (!active) {
          if (url) {
            revokePhotoObjectUrl(
              url,
            );
          }

          return;
        }

        objectUrl = url;
        setPhotoUrl(url);
      } catch {
        if (active) {
          setPhotoUrl("");
        }
      }
    }


    void loadPhoto();


    return () => {
      active = false;

      if (objectUrl) {
        revokePhotoObjectUrl(
          objectUrl,
        );
      }
    };
  }, [
    userId,
    hasPhoto,
  ]);


  const initial =
    name
      .trim()
      .charAt(0)
      .toUpperCase() || "?";


  return (
    <div
      style={{
        width: "52px",
        height: "52px",
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        color: "#fff",
        fontWeight: 800,
        fontSize: "18px",
        flexShrink: 0,
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Fotografia de ${name}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
}


const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding: "11px 12px",
  border: "1px solid #d8d8d8",
  borderRadius: "9px",
  background: "#fff",
  font: "inherit",
};