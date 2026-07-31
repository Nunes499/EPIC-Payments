import type { ReactNode } from "react";

import Card from "./Card";

type StatCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
};

export default function StatCard({
  title,
  value,
  description,
  icon,
}: StatCardProps) {
  return (
    <Card className="stat-card">
      <div className="stat-card-header">
        <div className="stat-card-icon">{icon}</div>

        <span className="stat-card-status" />
      </div>

      <span className="stat-card-title">{title}</span>

      <strong className="stat-card-value">{value}</strong>

      <small className="stat-card-description">{description}</small>
    </Card>
  );
}