"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";

import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getToken,
  getUserPhotoObjectUrl,
  resetUserPassword,
  revokePhotoObjectUrl,
  uploadUserPhoto,
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
  const { user, refreshUser } = useAuth();

  const [users, setUsers] =
    useState<UserItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
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

  const [
    editingUser,
    setEditingUser,
  ] = useState<UserItem | null>(null);
  const [editName, setEditName] =
    useState("");
  const [
    editUsername,
    setEditUsername,
  ] = useState("");
  const [editEmail, setEditEmail] =
    useState("");
  const [editRole, setEditRole] =
    useState<UserItem["role"]>(
      "collaborator",
    );
  const [
    editIsActive,
    setEditIsActive,
  ] = useState(true);
  const [editPhoto, setEditPhoto] =
    useState<File | null>(null);
  const [savingEdit, setSavingEdit] =
    useState(false);
  const [editError, setEditError] =
    useState("");

  const [
    adminNewPassword,
    setAdminNewPassword,
  ] = useState("");
  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState("");
  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);

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

      setUsers(await response.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar utilizadores.",
      );
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

  function openEdit(
    item: UserItem,
  ) {
    setEditingUser(item);
    setEditName(item.name);
    setEditUsername(item.username);
    setEditEmail(item.email);
    setEditRole(item.role);
    setEditIsActive(item.is_active);
    setEditPhoto(null);
    setEditError("");
    setAdminNewPassword("");
    setPasswordMessage("");
  }

  async function responseError(
    response: Response,
    fallback: string,
  ) {
    try {
      const data =
        await response.json();

      return typeof data?.detail ===
        "string"
        ? data.detail
        : fallback;
    } catch {
      return fallback;
    }
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
        throw new Error(
          await responseError(
            response,
            "Não foi possível criar o utilizador.",
          ),
        );
      }

      setShowCreate(false);
      resetCreateForm();
      setLoading(true);
      await loadUsers();
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Erro ao criar utilizador.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingUser) return;

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
            name: editName.trim(),
            username:
              editUsername.trim(),
            email: editEmail.trim(),
            role: editRole,
            is_active:
              editIsActive,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await responseError(
            response,
            "Não foi possível guardar as alterações.",
          ),
        );
      }

      if (editPhoto) {
        await uploadUserPhoto(
          editingUser.id,
          editPhoto,
        );
      }

      if (
        user?.id === editingUser.id
      ) {
        await refreshUser();
      }

      setEditingUser(null);
      setLoading(true);
      await loadUsers();
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : "Erro ao guardar alterações.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePasswordReset() {
    if (!editingUser) return;

    if (
      adminNewPassword.length < 8
    ) {
      setPasswordMessage(
        "A password deve ter pelo menos 8 caracteres.",
      );
      return;
    }

    try {
      setResettingPassword(true);
      setPasswordMessage("");

      await resetUserPassword(
        editingUser.id,
        adminNewPassword,
      );

      setAdminNewPassword("");
      setPasswordMessage(
        "Password alterada com sucesso.",
      );
    } catch (err) {
      setPasswordMessage(
        err instanceof Error
          ? err.message
          : "Erro ao alterar password.",
      );
    } finally {
      setResettingPassword(false);
    }
  }

  if (
    user &&
    user.role !== "admin"
  ) {
    return (
      <AppLayout>
        <div style={{ padding: "32px" }}>
          <h2>Acesso reservado</h2>
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
      <div style={{ padding: "28px" }}>
        <div style={pageHeaderStyle}>
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
                margin: "6px 0 0",
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
            style={primaryButton}
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
          <div style={errorStyle}>
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
              {users.map((item) => (
                <div
                  key={item.id}
                  style={userRowStyle}
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
                        marginTop:
                          "4px",
                        color: "#777",
                        fontSize:
                          "13px",
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
                        padding:
                          "6px 10px",
                        borderRadius:
                          "999px",
                        fontSize:
                          "12px",
                        fontWeight:
                          700,
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
                    onClick={() =>
                      openEdit(item)
                    }
                    style={
                      secondaryButton
                    }
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>

      {editingUser && (
        <Modal
          title="Editar utilizador"
          subtitle={editingUser.name}
          onClose={() => {
            if (!savingEdit) {
              setEditingUser(null);
            }
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "18px",
            }}
          >
            <label style={labelStyle}>
              Nova fotografia
              (opcional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setEditPhoto(
                    event.target
                      .files?.[0] ??
                      null,
                  )
                }
                style={inputStyle}
              />
              <span
                style={helpTextStyle}
              >
                Se não selecionar
                nenhuma, mantém a
                fotografia atual.
              </span>
            </label>

            <label style={labelStyle}>
              Nome
              <input
                value={editName}
                onChange={(event) =>
                  setEditName(
                    event.target
                      .value,
                  )
                }
                style={inputStyle}
              />
            </label>

            <div style={twoColumns}>
              <label
                style={labelStyle}
              >
                Username
                <input
                  value={editUsername}
                  onChange={(
                    event,
                  ) =>
                    setEditUsername(
                      event.target
                        .value,
                    )
                  }
                  style={inputStyle}
                />
              </label>

              <label
                style={labelStyle}
              >
                Tipo de utilizador
                <select
                  value={editRole}
                  onChange={(
                    event,
                  ) =>
                    setEditRole(
                      event.target
                        .value as
                        UserItem["role"],
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

            <label style={labelStyle}>
              Email
              <input
                type="email"
                value={editEmail}
                onChange={(event) =>
                  setEditEmail(
                    event.target
                      .value,
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
              }}
            >
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(event) =>
                  setEditIsActive(
                    event.target
                      .checked,
                  )
                }
              />
              Utilizador ativo
            </label>

            {editError && (
              <div style={errorStyle}>
                {editError}
              </div>
            )}

            <div style={buttonRow}>
              <button
                type="button"
                onClick={() =>
                  setEditingUser(null)
                }
                disabled={savingEdit}
                style={
                  secondaryButton
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  handleSaveEdit
                }
                disabled={savingEdit}
                style={primaryButton}
              >
                {savingEdit
                  ? "A guardar..."
                  : "Guardar alterações"}
              </button>
            </div>

            <div
              style={{
                borderTop:
                  "1px solid #ededed",
                paddingTop: "20px",
              }}
            >
              <h3
                style={{
                  margin:
                    "0 0 12px",
                }}
              >
                Redefinir password
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                }}
              >
                <input
                  type="password"
                  value={
                    adminNewPassword
                  }
                  minLength={8}
                  placeholder="Nova password"
                  onChange={(event) =>
                    setAdminNewPassword(
                      event.target
                        .value,
                    )
                  }
                  style={inputStyle}
                />

                <button
                  type="button"
                  onClick={
                    handlePasswordReset
                  }
                  disabled={
                    resettingPassword
                  }
                  style={
                    secondaryButton
                  }
                >
                  {resettingPassword
                    ? "A alterar..."
                    : "Alterar password"}
                </button>
              </div>

              {passwordMessage && (
                <div
                  style={{
                    marginTop:
                      "10px",
                    fontSize:
                      "14px",
                  }}
                >
                  {passwordMessage}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal
          title="Novo utilizador"
          subtitle="Criar um novo acesso ao sistema."
          onClose={() => {
            if (!creating) {
              setShowCreate(false);
              resetCreateForm();
            }
          }}
        >
          <form
            onSubmit={handleCreate}
            style={{
              display: "grid",
              gap: "18px",
            }}
          >
            <label style={labelStyle}>
              Fotografia *
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) =>
                  setPhoto(
                    event.target
                      .files?.[0] ??
                      null,
                  )
                }
                style={inputStyle}
              />
              <span
                style={helpTextStyle}
              >
                JPG, PNG ou WEBP.
                Máximo 5 MB.
              </span>
            </label>

            <label style={labelStyle}>
              Nome *
              <input
                value={name}
                required
                minLength={2}
                onChange={(event) =>
                  setName(
                    event.target
                      .value,
                  )
                }
                style={inputStyle}
              />
            </label>

            <div style={twoColumns}>
              <label
                style={labelStyle}
              >
                Username *
                <input
                  value={username}
                  required
                  minLength={3}
                  onChange={(
                    event,
                  ) =>
                    setUsername(
                      event.target
                        .value,
                    )
                  }
                  style={inputStyle}
                />
              </label>

              <label
                style={labelStyle}
              >
                Tipo de utilizador *
                <select
                  value={role}
                  onChange={(
                    event,
                  ) =>
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

            <label style={labelStyle}>
              Email *
              <input
                type="email"
                value={email}
                required
                onChange={(event) =>
                  setEmail(
                    event.target
                      .value,
                  )
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Password *
              <input
                type="password"
                value={password}
                required
                minLength={8}
                onChange={(event) =>
                  setPassword(
                    event.target
                      .value,
                  )
                }
                style={inputStyle}
              />
              <span
                style={helpTextStyle}
              >
                Mínimo de 8
                caracteres.
              </span>
            </label>

            {createError && (
              <div style={errorStyle}>
                {createError}
              </div>
            )}

            <div style={buttonRow}>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(
                    false,
                  );
                  resetCreateForm();
                }}
                disabled={creating}
                style={
                  secondaryButton
                }
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={creating}
                style={primaryButton}
              >
                {creating
                  ? "A criar..."
                  : "Criar utilizador"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
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
          "rgba(0,0,0,.55)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: "650px",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "18px",
          background: "#fff",
          boxShadow:
            "0 24px 80px rgba(0,0,0,.25)",
        }}
      >
        <div
          style={{
            display: "flex",
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
              }}
            >
              EPIC PAYMENTS
            </div>

            <h2
              style={{
                margin: "6px 0 0",
              }}
            >
              {title}
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#707070",
                fontSize: "14px",
              }}
            >
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: "36px",
              height: "36px",
              border:
                "1px solid #ddd",
              borderRadius: "50%",
              background: "#fff",
              fontSize: "21px",
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
          {children}
        </div>
      </div>
    </div>
  );
}

function UserAvatar({
  userId,
  name,
  hasPhoto,
}: {
  userId: number;
  name: string;
  hasPhoto: boolean;
}) {
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
    <div style={avatarStyle}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Fotografia de ${name}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
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
  boxSizing: "border-box" as const,
  padding: "11px 12px",
  border: "1px solid #d8d8d8",
  borderRadius: "9px",
  background: "#fff",
  font: "inherit",
};

const labelStyle = {
  display: "grid",
  gap: "7px",
  fontWeight: 700,
  fontSize: "14px",
};

const helpTextStyle = {
  color: "#888",
  fontSize: "12px",
  fontWeight: 400,
};

const primaryButton = {
  border: 0,
  borderRadius: "9px",
  padding: "11px 18px",
  background: "#d71920",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #d8d8d8",
  borderRadius: "9px",
  padding: "10px 16px",
  background: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle = {
  padding: "12px 14px",
  borderRadius: "9px",
  background: "#fdecec",
  color: "#a40000",
  fontSize: "13px",
  fontWeight: 600,
};

const buttonRow = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const twoColumns = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: "16px",
};

const pageHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "24px",
};

const userRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "70px 1.4fr 1fr 1.6fr 1fr 110px",
  alignItems: "center",
  gap: "16px",
  padding: "16px",
  border: "1px solid #e2e2e2",
  borderRadius: "14px",
  background: "#fff",
};

const avatarStyle = {
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
};
