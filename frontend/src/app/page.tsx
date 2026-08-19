import AnnualCalendar from "@/components/calendar/AnnualCalendar";
import AppLayout from "@/components/layout/AppLayout";

export default function Home() {
  return (
    <AppLayout>
      <AnnualCalendar initialYear={2026} />
    </AppLayout>
  );
}