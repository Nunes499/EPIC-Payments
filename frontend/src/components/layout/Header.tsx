"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";

import {
  getMyPhotoObjectUrl,
  revokePhotoObjectUrl,
} from "@/services/auth";


const pageInfo: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {
  "/": {
    title: "Calendário",
    subtitle:
      "Gestão diária dos ficheiros bancários e relatórios.",
  },

  "/settings": {
    title: "Definições",
    subtitle:
      "Gestão e configuração do sistema.",
  },

  "/processamentos": {
    title: "Processamentos",
    subtitle:
      "Gestão e acompanhamento dos processamentos bancários.",
  },

  "/relatorios": {
    title: "Relatórios",
    subtitle:
      "Consulta e gestão dos relatórios do EPIC Payments.",
  },

  "/utilizadores": {
    title: "Utilizadores",
    subtitle:
      "Gestão dos utilizadores e acessos ao sistema.",
  },

  "/perfil": {
    title: "Perfil",
    subtitle:
      "Gestão da sua fotografia e password.",
  },
};


export default function Header() {
  const pathname = usePathname();

  const {
    user,
    logout,
  } = useAuth();

  const [
    photoUrl,
    setPhotoUrl,
  ] = useState("");


  const currentPage =
    pageInfo[pathname] ??
    pageInfo["/"];


  const hidePageHeading =
    pathname ===
    "/pesquisa_bancaria";


  const roleLabel =
    user?.role === "admin"
      ? "Administrador"
      : "Colaborador";


  const initial =
    user?.name
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?";


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


  return (
    <header className="topbar">
      {!hidePageHeading ? (
        <div className="topbar-heading">
          <span className="page-kicker">
            EPIC Payments
          </span>

          <h1 className="topbar-title">
            {currentPage.title}
          </h1>

          <p className="topbar-subtitle">
            {currentPage.subtitle}
          </p>
        </div>
      ) : (
        <div />
      )}

      <div className="topbar-user">
        <Link
          href="/perfil"
          aria-label="Abrir o meu perfil"
          title="Abrir perfil"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          <div
            className="user-avatar"
            aria-label={
              user
                ? `Utilizador ${user.name}`
                : "Utilizador"
            }
            style={{
              overflow: "hidden",
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={
                  user
                    ? `Fotografia de ${user.name}`
                    : "Fotografia de perfil"
                }
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

          <div className="user-info">
            <strong>
              {user?.name ??
                "Utilizador"}
            </strong>

            <span>
              {roleLabel}
            </span>
          </div>
        </Link>

        <button
          type="button"
          className="logout-button"
          onClick={logout}
        >
          Terminar sessão
        </button>
      </div>
    </header>
  );
}