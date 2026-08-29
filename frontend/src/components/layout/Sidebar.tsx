"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarDays,
  ReceiptText,
  Search,
  Settings,
  Users,
} from "lucide-react";

import styles from "./Sidebar.module.css";

const menuItems = [
  {
    label: "Calendário",
    icon: CalendarDays,
    href: "/",
  },
  {
    label: "Pesquisa Bancária",
    icon: Search,
    href: "/pesquisa_bancaria",
  },
  {
    label: "Criar Referência",
    icon: ReceiptText,
    href: "#",
  },
  {
    label: "Utilizadores",
    icon: Users,
    href: "#",
  },
  {
    label: "Definições",
    icon: Settings,
    href: "/settings",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <Image
          src="/branding/logo-epic-payments-white.png"
          alt="EPIC Payments"
          width={220}
          height={120}
          priority
          className={styles.logo}
        />
      </div>

      <nav
        className={styles.navigation}
        aria-label="Menu principal"
      >
        {menuItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.label === "Calendário"
              ? pathname === "/"
              : pathname === item.href &&
                item.href !== "#";

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.menuCard} ${
                active ? styles.active : ""
              }`}
            >
              <span className={styles.mainIcon}>
                <Icon
                  size={39}
                  strokeWidth={1.8}
                />
              </span>

              <span className={styles.menuLabel}>
                {item.label}
              </span>

              <span
                className={styles.ghostIcon}
                aria-hidden="true"
              >
                <Icon
                  size={76}
                  strokeWidth={1.35}
                />
              </span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerAvatar}>
          N
        </div>

        <div className={styles.footerText}>
          <span>
            SISTEMA INTERNO
          </span>

          <strong>
            EPIC Fitness
          </strong>
        </div>
      </div>
    </aside>
  );
}