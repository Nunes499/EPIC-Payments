"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Camera,
  Check,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  changeMyPassword,
  getMyPhotoObjectUrl,
  revokePhotoObjectUrl,
  uploadMyPhoto,
} from "@/services/auth";

export default function PerfilPage() {
  const { user, refreshUser } =
    useAuth();

  const [photoUrl, setPhotoUrl] =
    useState("");

  const [photo, setPhoto] =
    useState<File | null>(null);

  const [
    savingPhoto,
    setSavingPhoto,
  ] = useState(false);

  const [
    photoMessage,
    setPhotoMessage,
  ] = useState("");

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    savingPassword,
    setSavingPassword,
  ] = useState(false);

  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    async function loadPhoto() {
      if (!user?.has_photo) {
        setPhotoUrl("");
        return;
      }

      try {
        const url =
          await getMyPhotoObjectUrl();

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
    user?.id,
    user?.has_photo,
    user?.updated_at,
  ]);

  async function savePhoto(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!photo) {
      setPhotoMessage(
        "Selecione uma fotografia.",
      );
      return;
    }

    try {
      setSavingPhoto(true);
      setPhotoMessage("");

      await uploadMyPhoto(photo);

      await refreshUser();

      setPhoto(null);

      setPhotoMessage(
        "Fotografia alterada com sucesso.",
      );
    } catch (error) {
      setPhotoMessage(
        error instanceof Error
          ? error.message
          : "Erro ao alterar fotografia.",
      );
    } finally {
      setSavingPhoto(false);
    }
  }

  async function savePassword(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setPasswordMessage(
        "A nova password deve ter pelo menos 8 caracteres.",
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordMessage(
        "As novas passwords não coincidem.",
      );
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordMessage("");

      await changeMyPassword(
        currentPassword,
        newPassword,
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setPasswordMessage(
        "Password alterada com sucesso.",
      );
    } catch (error) {
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Erro ao alterar password.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const initial =
    user?.name
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?";

  const roleLabel =
    user?.role === "admin"
      ? "Administrador"
      : "Colaborador";

  return (
    <AppLayout>
      <main style={pageStyle}>
        {/* PERFIL PRINCIPAL */}
        <section
          style={profileHeroStyle}
        >
          <div
            style={redSideAccentStyle}
          />

          <div
            style={profileHeroContent}
          >
            <div
              style={profileMainStyle}
            >
              <div
                style={largeAvatarStyle}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Fotografia de perfil"
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

              <div>
                <div
                  style={
                    profileKickerStyle
                  }
                >
                  PERFIL EPIC PAYMENTS
                </div>

                <h1
                  style={
                    profileNameStyle
                  }
                >
                  {user?.name}
                </h1>

                <div
                  style={
                    profileInfoLineStyle
                  }
                >
                  <span>
                    @{user?.username}
                  </span>

                  <span
                    style={
                      profileSeparatorStyle
                    }
                  />

                  <span>
                    {user?.email}
                  </span>
                </div>

                <div
                  style={
                    roleBadgeStyle
                  }
                >
                  <span
                    style={roleDotStyle}
                  />

                  {roleLabel}
                </div>
              </div>
            </div>

            <div
              style={accountStatusStyle}
            >
              <span
                style={
                  accountStatusLabelStyle
                }
              >
                ESTADO DA CONTA
              </span>

              <div
                style={
                  activeAccountStyle
                }
              >
                <span
                  style={
                    activeDotStyle
                  }
                />

                Conta ativa
              </div>
            </div>
          </div>
        </section>

        {/* CONTEÚDO */}
        <div style={mainGridStyle}>
          <div
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            {/* INFORMAÇÕES */}
            <section
              style={whiteCardStyle}
            >
              <SectionHeader
                icon={
                  <UserRound
                    size={21}
                    strokeWidth={2.3}
                  />
                }
                title="Informações da conta"
                subtitle="Dados associados ao seu acesso ao EPIC Payments."
              />

              <div
                style={
                  accountInfoGridStyle
                }
              >
                <InfoBox
                  label="Nome completo"
                  value={
                    user?.name || "—"
                  }
                />

                <InfoBox
                  label="Username"
                  value={
                    user?.username
                      ? `@${user.username}`
                      : "—"
                  }
                />

                <InfoBox
                  label="Email"
                  value={
                    user?.email || "—"
                  }
                />

                <InfoBox
                  label="Tipo de utilizador"
                  value={roleLabel}
                />
              </div>
            </section>

            {/* FOTO */}
            <section
              style={whiteCardStyle}
            >
              <SectionHeader
                icon={
                  <Camera
                    size={21}
                    strokeWidth={2.3}
                  />
                }
                title="Fotografia de perfil"
                subtitle="Esta fotografia é apresentada no seu perfil e no cabeçalho da aplicação."
              />

              <div
                style={
                  photoContentStyle
                }
              >
                <div
                  style={
                    photoPreviewStyle
                  }
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Fotografia atual"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit:
                          "cover",
                        display:
                          "block",
                      }}
                    />
                  ) : (
                    initial
                  )}
                </div>

                <form
                  onSubmit={savePhoto}
                  style={
                    photoFormStyle
                  }
                >
                  <div>
                    <label
                      style={
                        fieldLabelStyle
                      }
                    >
                      Escolher nova
                      fotografia
                    </label>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(
                        event,
                      ) =>
                        setPhoto(
                          event.target
                            .files?.[0] ??
                            null,
                        )
                      }
                      style={
                        fileInputStyle
                      }
                    />

                    <p
                      style={
                        helpTextStyle
                      }
                    >
                      Formatos permitidos:
                      JPG, PNG ou WEBP.
                      Tamanho máximo de
                      5 MB.
                    </p>
                  </div>

                  {photo && (
                    <div
                      style={
                        selectedFileStyle
                      }
                    >
                      <Check
                        size={15}
                      />
                      {photo.name}
                    </div>
                  )}

                  {photoMessage && (
                    <MessageBox
                      message={
                        photoMessage
                      }
                    />
                  )}

                  <button
                    type="submit"
                    disabled={
                      savingPhoto
                    }
                    style={{
                      ...redGradientButtonStyle,
                      opacity:
                        savingPhoto
                          ? 0.65
                          : 1,
                    }}
                  >
                    {savingPhoto
                      ? "A guardar..."
                      : "Guardar fotografia"}
                  </button>
                </form>
              </div>
            </section>
          </div>

          {/* SEGURANÇA */}
          <section
            style={securityCardStyle}
          >
            <SectionHeader
              icon={
                <LockKeyhole
                  size={21}
                  strokeWidth={2.3}
                />
              }
              title="Segurança"
              subtitle="Altere a password utilizada para entrar na sua conta."
            />

            <div
              style={
                securityNoticeStyle
              }
            >
              <div
                style={
                  securityCheckStyle
                }
              >
                <ShieldCheck
                  size={19}
                  strokeWidth={2.4}
                />
              </div>

              <div>
                <strong
                  style={{
                    color: "#171717",
                    fontSize:
                      "14px",
                  }}
                >
                  Proteja o seu acesso
                </strong>

                <p
                  style={{
                    margin:
                      "4px 0 0",
                    color: "#777",
                    fontSize:
                      "12px",
                    lineHeight: 1.55,
                  }}
                >
                  Utilize uma password
                  exclusiva com pelo
                  menos 8 caracteres.
                </p>
              </div>
            </div>

            <form
              onSubmit={savePassword}
              style={passwordFormStyle}
            >
              <PasswordField
                label="Password atual"
                value={
                  currentPassword
                }
                onChange={
                  setCurrentPassword
                }
                autoComplete="current-password"
              />

              <div
                style={
                  formDividerStyle
                }
              />

              <PasswordField
                label="Nova password"
                value={newPassword}
                onChange={
                  setNewPassword
                }
                autoComplete="new-password"
              />

              <PasswordField
                label="Confirmar nova password"
                value={
                  confirmPassword
                }
                onChange={
                  setConfirmPassword
                }
                autoComplete="new-password"
              />

              <p
                style={helpTextStyle}
              >
                A nova password deverá
                ter um mínimo de 8
                caracteres.
              </p>

              {passwordMessage && (
                <MessageBox
                  message={
                    passwordMessage
                  }
                />
              )}

              <button
                type="submit"
                disabled={
                  savingPassword
                }
                style={{
                  ...redGradientButtonStyle,
                  width: "100%",
                  justifyContent:
                    "center",
                  opacity:
                    savingPassword
                      ? 0.65
                      : 1,
                }}
              >
                {savingPassword
                  ? "A alterar..."
                  : "Alterar password"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={
        sectionHeaderStyle
      }
    >
      <div
        style={
          sectionIconStyle
        }
      >
        {icon}
      </div>

      <div>
        <h2
          style={
            sectionTitleStyle
          }
        >
          {title}
        </h2>

        <p
          style={
            sectionSubtitleStyle
          }
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoBoxStyle}>
      <span style={infoLabelStyle}>
        {label}
      </span>

      <strong
        style={infoValueStyle}
      >
        {value}
      </strong>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  autoComplete: string;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: "8px",
      }}
    >
      <span
        style={fieldLabelStyle}
      >
        {label}
      </span>

      <input
        type="password"
        value={value}
        required
        minLength={8}
        autoComplete={
          autoComplete
        }
        placeholder="••••••••"
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        style={
          passwordInputStyle
        }
      />
    </label>
  );
}

function MessageBox({
  message,
}: {
  message: string;
}) {
  const success =
    message
      .toLowerCase()
      .includes("sucesso");

  return (
    <div
      style={{
        padding:
          "11px 13px",
        borderRadius: "9px",
        fontSize: "13px",
        fontWeight: 600,

        background: success
          ? "#eaf8ef"
          : "#fff0f0",

        color: success
          ? "#176b38"
          : "#a40000",

        border: success
          ? "1px solid #ccebd7"
          : "1px solid #ffd4d4",
      }}
    >
      {message}
    </div>
  );
}

/* ============================= */
/* ESTILOS                       */
/* ============================= */

const pageStyle = {
  width: "100%",
  maxWidth: "1480px",
  margin: "0 auto",
  padding:
    "32px 38px 60px",
  boxSizing:
    "border-box" as const,
};

/* CARTÃO PERFIL - PRATEADO */

const profileHeroStyle = {
  position:
    "relative" as const,
  overflow: "hidden",

  background:
    "linear-gradient(115deg, #252525 0%, #505050 34%, #8b8b8b 58%, #525252 78%, #303030 100%)",

  borderRadius: "20px",

  marginBottom: "24px",

  border:
    "1px solid rgba(255,255,255,0.22)",

  boxShadow:
    "0 16px 40px rgba(0,0,0,0.14)",
};

const redSideAccentStyle = {
  position:
    "absolute" as const,

  left: 0,
  top: 0,
  bottom: 0,

  width: "6px",

  background:
    "linear-gradient(180deg, #ff2a32 0%, #c9000c 55%, #7d0007 100%)",
};

const profileHeroContent = {
  minHeight: "180px",

  padding:
    "30px 34px",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "space-between",

  gap: "30px",
};

const profileMainStyle = {
  display: "flex",
  alignItems: "center",
  gap: "24px",
};

const largeAvatarStyle = {
  width: "112px",
  height: "112px",

  flexShrink: 0,

  borderRadius: "50%",

  overflow: "hidden",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  background:
    "linear-gradient(145deg, #a4000a, #ef1722)",

  border:
    "4px solid rgba(255,255,255,0.94)",

  boxShadow:
    "0 8px 26px rgba(0,0,0,0.30)",

  color: "#fff",

  fontSize: "34px",

  fontWeight: 800,
};

const profileKickerStyle = {
  color: "#ff2832",

  fontSize: "11px",

  fontWeight: 900,

  letterSpacing: "1.8px",

  marginBottom: "7px",
};

const profileNameStyle = {
  margin: 0,

  color: "#fff",

  fontSize: "31px",

  lineHeight: 1.15,

  fontWeight: 900,

  textShadow:
    "0 2px 5px rgba(0,0,0,0.25)",
};

const profileInfoLineStyle = {
  marginTop: "8px",

  display: "flex",

  alignItems: "center",

  flexWrap: "wrap" as const,

  gap: "10px",

  color: "#f1f1f1",

  fontSize: "13px",

  textShadow:
    "0 1px 3px rgba(0,0,0,0.25)",
};

const profileSeparatorStyle = {
  width: "4px",
  height: "4px",

  borderRadius: "50%",

  background:
    "rgba(255,255,255,0.70)",
};

const roleBadgeStyle = {
  marginTop: "14px",

  display:
    "inline-flex",

  alignItems: "center",

  gap: "7px",

  padding: "7px 12px",

  borderRadius:
    "999px",

  background:
    "rgba(16,16,16,0.72)",

  border:
    "1px solid rgba(255,255,255,0.14)",

  color: "#fff",

  fontSize: "12px",

  fontWeight: 700,

  boxShadow:
    "0 4px 12px rgba(0,0,0,.12)",
};

const roleDotStyle = {
  width: "7px",
  height: "7px",

  borderRadius: "50%",

  background: "#ec101c",

  boxShadow:
    "0 0 0 4px rgba(236,16,28,.15)",
};

const accountStatusStyle = {
  display: "grid",

  justifyItems: "end",

  gap: "10px",
};

const accountStatusLabelStyle = {
  color: "#eeeeee",

  fontSize: "10px",

  fontWeight: 900,

  letterSpacing: "1.5px",

  textShadow:
    "0 1px 3px rgba(0,0,0,.25)",
};

const activeAccountStyle = {
  display: "flex",

  alignItems: "center",

  gap: "8px",

  padding: "9px 14px",

  borderRadius:
    "999px",

  background:
    "rgba(17,58,44,.72)",

  border:
    "1px solid rgba(45,220,150,.28)",

  color: "#48e29b",

  fontSize: "13px",

  fontWeight: 800,

  boxShadow:
    "0 4px 14px rgba(0,0,0,.12)",
};

const activeDotStyle = {
  width: "8px",
  height: "8px",

  borderRadius: "50%",

  background: "#13d981",

  boxShadow:
    "0 0 0 4px rgba(19,217,129,.15)",
};

/* GRID PRINCIPAL */

const mainGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "minmax(0, 1.7fr) minmax(330px, 0.8fr)",

  gap: "22px",

  alignItems: "start",
};

/* CARTÕES BRANCOS */

const whiteCardStyle = {
  background:
    "linear-gradient(145deg, #ffffff 0%, #fefefe 55%, #fafafa 100%)",

  border:
    "1px solid #e4e4e4",

  borderRadius: "18px",

  padding: "25px",

  boxShadow:
    "0 8px 24px rgba(0,0,0,0.055)",
};

const securityCardStyle = {
  ...whiteCardStyle,

  position:
    "sticky" as const,

  top: "24px",
};

const sectionHeaderStyle = {
  display: "flex",

  alignItems:
    "flex-start",

  gap: "14px",

  paddingBottom:
    "20px",

  marginBottom:
    "20px",

  borderBottom:
    "1px solid #ececec",
};

/* ÍCONES - VERMELHO ESCURO DEGRADÊ */

const sectionIconStyle = {
  width: "42px",
  height: "42px",

  flexShrink: 0,

  borderRadius:
    "11px",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  color: "#fff",

  background:
    "linear-gradient(145deg, #7d0007 0%, #b7000b 48%, #e51a25 100%)",

  boxShadow:
    "0 6px 16px rgba(154,0,9,.18)",
};

const sectionTitleStyle = {
  margin: 0,

  color: "#171717",

  fontSize: "18px",

  fontWeight: 900,
};

const sectionSubtitleStyle = {
  margin: "5px 0 0",

  color: "#777",

  fontSize: "13px",

  lineHeight: 1.5,
};

const accountInfoGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

  gap: "12px",
};

const infoBoxStyle = {
  padding:
    "15px 16px",

  background:
    "linear-gradient(145deg, #fafafa 0%, #f1f1f1 100%)",

  border:
    "1px solid #e6e6e6",

  borderRadius:
    "11px",

  display: "grid",

  gap: "5px",
};

const infoLabelStyle = {
  color: "#8a8a8a",

  fontSize: "11px",

  fontWeight: 800,

  textTransform:
    "uppercase" as const,

  letterSpacing:
    "0.5px",
};

const infoValueStyle = {
  color: "#181818",

  fontSize: "14px",

  overflowWrap:
    "anywhere" as const,

  fontWeight: 800,
};

/* FOTO */

const photoContentStyle = {
  display: "grid",

  gridTemplateColumns:
    "140px minmax(0, 1fr)",

  gap: "25px",

  alignItems: "center",
};

const photoPreviewStyle = {
  width: "130px",
  height: "130px",

  borderRadius:
    "16px",

  overflow: "hidden",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  background:
    "linear-gradient(145deg, #252525, #555)",

  color: "#fff",

  fontSize: "34px",

  fontWeight: 900,

  border:
    "1px solid #d8d8d8",

  boxShadow:
    "0 7px 20px rgba(0,0,0,.08)",
};

const photoFormStyle = {
  display: "grid",
  gap: "12px",
};

const fieldLabelStyle = {
  display: "block",

  marginBottom: "7px",

  color: "#292929",

  fontSize: "13px",

  fontWeight: 800,
};

const fileInputStyle = {
  width: "100%",

  boxSizing:
    "border-box" as const,

  padding: "10px",

  border:
    "1px solid #d6d6d6",

  borderRadius: "9px",

  background:
    "linear-gradient(180deg, #fff, #fafafa)",

  font: "inherit",

  fontSize: "13px",
};

const helpTextStyle = {
  margin: "7px 0 0",

  color: "#8a8a8a",

  fontSize: "11px",

  lineHeight: 1.5,
};

const selectedFileStyle = {
  display: "flex",

  alignItems: "center",

  gap: "8px",

  padding: "9px 11px",

  borderRadius: "8px",

  background: "#f3f3f3",

  color: "#555",

  fontSize: "12px",
};

/* BOTÕES - VERMELHO ESCURO DEGRADÊ */

const redGradientButtonStyle = {
  minHeight: "43px",

  display:
    "inline-flex",

  alignItems: "center",

  justifyContent:
    "center",

  justifySelf:
    "start",

  border: 0,

  borderRadius: "9px",

  padding: "0 19px",

  background:
    "linear-gradient(100deg, #760008 0%, #a9000b 35%, #d5101c 72%, #b0000b 100%)",

  color: "#fff",

  fontSize: "13px",

  fontWeight: 900,

  cursor: "pointer",

  boxShadow:
    "0 7px 18px rgba(148,0,9,.20)",

  textShadow:
    "0 1px 2px rgba(0,0,0,.20)",
};

/* SEGURANÇA */

const securityNoticeStyle = {
  display: "flex",

  gap: "11px",

  alignItems:
    "flex-start",

  padding: "14px",

  marginBottom:
    "20px",

  background:
    "linear-gradient(145deg, #fafafa, #f1f1f1)",

  borderRadius: "11px",

  border:
    "1px solid #e7e7e7",
};

const securityCheckStyle = {
  width: "31px",
  height: "31px",

  flexShrink: 0,

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  borderRadius:
    "50%",

  background:
    "linear-gradient(145deg, #dff5e8, #effbf4)",

  color: "#179353",
};

const passwordFormStyle = {
  display: "grid",
  gap: "15px",
};

const passwordInputStyle = {
  width: "100%",

  boxSizing:
    "border-box" as const,

  height: "44px",

  padding:
    "0 12px",

  border:
    "1px solid #d5d5d5",

  borderRadius:
    "9px",

  background:
    "linear-gradient(180deg, #fff, #fbfbfb)",

  font: "inherit",

  outline: "none",
};

const formDividerStyle = {
  height: "1px",

  background: "#ededed",

  margin: "2px 0",
};