"use client";

import Image from "next/image";
import {
  CalendarDays,
  FileStack,
  House,
  Settings,
  Users,
  BarChart3,
} from "lucide-react";

const menuItems = [
  {
    label: "Início",
    icon: House,
    active: false,
  },
  {
    label: "Calendário",
    icon: CalendarDays,
    active: true,
  },
  {
    label: "Processamentos",
    icon: FileStack,
    active: false,
  },
  {
    label: "Relatórios",
    icon: BarChart3,
    active: false,
  },
  {
    label: "Utilizadores",
    icon: Users,
    active: false,
  },
  {
    label: "Definições",
    icon: Settings,
    active: false,
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Image
          src="/branding/logo-epic-payments-white.png"
          alt="EPIC Payments"
          width={190}
          height={110}
          priority
          className="sidebar-logo-image"
        />
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              className={`sidebar-link ${item.active ? "active" : ""}`}
            >
              <Icon size={19} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-label">Sistema interno</span>
        <strong>EPIC Fitness</strong>
      </div>
    </aside>
  );
}