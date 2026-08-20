"use client";

import { usePathname } from "next/navigation";


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
};


export default function Header() {
  const pathname =
    usePathname();

  const currentPage =
    pageInfo[pathname] ??
    pageInfo["/"];

  return (
    <header className="topbar">
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

      <div className="topbar-user">
        <div
          className="user-avatar"
          aria-hidden="true"
        >
          A
        </div>

        <div className="user-info">
          <strong>
            Administrador
          </strong>

          <span>
            admin
          </span>
        </div>

        <button
          type="button"
          className="logout-button"
        >
          Terminar sessão
        </button>
      </div>
    </header>
  );
}