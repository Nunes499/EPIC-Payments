"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import AppLayout from "@/components/layout/AppLayout";
import BackupRecovery from "@/components/settings/BackupRecovery";
import CedisSettings from "@/components/settings/CedisSettings";
import CloudArchitecture from "@/components/settings/CloudArchitecture";
import CloudflareSystem from "@/components/settings/CloudflareSystem";
import CloudIntegrity from "@/components/settings/CloudIntegrity";
import EnvironmentSeparation from "@/components/settings/EnvironmentSeparation";
import InfrastructureHealth from "@/components/settings/InfrastructureHealth";
import NeonStorageUsage from "@/components/settings/NeonStorageUsage";

import "@/components/settings/cedis-history-scroll.css";


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

      <InfrastructureHealth />

      <CloudIntegrity />

      <BackupRecovery />

      <EnvironmentSeparation />

      <CloudArchitecture />

      <NeonStorageUsage />

      <CloudflareSystem />
    </AppLayout>
  );
}