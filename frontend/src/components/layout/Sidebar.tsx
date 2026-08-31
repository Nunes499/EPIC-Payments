"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarDays,
  ReceiptText,
  Search,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";

import styles from "./Sidebar.module.css";


export default function Sidebar() {
  const pathname = usePathname();

  const {
    user,
  } = useAuth();


  const isAdmin =
    user?.role === "admin";


  const commonItems = [
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
      href: "/criar_referencia",
    },
  ];


  const adminItems = [
    {
      label: "Utilizadores",
      icon: Users,
      href: "/utilizadores",
    },
    {
      label: "Definições",
      icon: Settings,
      href: "/settings",
    },
    {
      label: "Perfil",
      icon: UserRound,
      href: "/perfil",
    },
  ];


  const collaboratorItems = [
    {
      label: "Perfil",
      icon: UserRound,
      href: "/perfil",
    },
  ];


  const menuItems = [
    ...commonItems,
    ...(isAdmin
      ? adminItems
      : collaboratorItems),
  ];


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
              : pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.menuCard} ${
                active
                  ? styles.active
                  : ""
              }`}
            >
              <span
                className={
                  styles.mainIcon
                }
              >
                <Icon
                  size={39}
                  strokeWidth={1.8}
                />
              </span>

              <span
                className={
                  styles.menuLabel
                }
              >
                {item.label}
              </span>

              <span
                className={
                  styles.ghostIcon
                }
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
        <div
          className={
            styles.footerAvatar
          }
        >
          {user?.name
            ?.trim()
            .charAt(0)
            .toUpperCase() || "E"}
        </div>

        <div
          className={
            styles.footerText
          }
        >
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
