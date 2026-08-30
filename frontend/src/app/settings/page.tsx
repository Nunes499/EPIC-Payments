"use client";

import CedisSettings from "@/components/settings/CedisSettings";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: "32px" }}>
          A carregar...
        </div>
      </AppLayout>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <AppLayout>
        <div style={{ padding: "32px" }}>
          <h2>Acesso reservado</h2>
          <p>
            Esta área está disponível apenas
            para Administradores.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <CedisSettings />
    </AppLayout>
  );
}
