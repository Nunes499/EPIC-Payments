"use client";

import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";


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
      "Gestão dos seus dados e password.",
  },
};


export default function Header() {
  const pathname = usePathname();

  const {
    user,
    logout,
  } = useAuth();


  const currentPage =
    pageInfo[pathname] ??
    pageInfo["/"];


  const hidePageHeading =
    pathname === "/pesquisa_bancaria";


  const roleLabel =
    user?.role === "admin"
      ? "Administrador"
      : "Colaborador";


  const initial =
    user?.name
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?";


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
        <div
          className="user-avatar"
          aria-label={
            user
              ? `Utilizador ${user.name}`
              : "Utilizador"
          }
          title={roleLabel}
        >
          {initial}
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