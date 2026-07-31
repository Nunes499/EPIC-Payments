import {
  BarChart3,
  FileText,
  Users,
} from "lucide-react";

import AnnualCalendar from "@/components/calendar/AnnualCalendar";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";

export default function Home() {
  return (
    <AppLayout>
      <section className="dashboard-grid">
        <StatCard
          title="Ficheiros hoje"
          value={0}
          description="Ficheiros bancários adicionados hoje"
          icon={<FileText size={22} />}
        />

        <StatCard
          title="Sócios pendentes"
          value={0}
          description="Sócios que aguardam processamento"
          icon={<Users size={22} />}
        />

        <StatCard
          title="Relatórios"
          value={0}
          description="Relatórios guardados este mês"
          icon={<BarChart3 size={22} />}
        />
      </section>

      <AnnualCalendar initialYear={2026} />
    </AppLayout>
  );
}