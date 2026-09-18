"use client";

import { Archive, CheckCircle2, Clock3, DatabaseBackup, HardDrive, History, RefreshCw, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getBackupRecovery, type BackupRecovery as BackupRecoveryData } from "@/services/system";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toLocaleString("pt-PT", { maximumFractionDigits: decimals })} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sem informação";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "medium" });
}

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${(hours / 24).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} dias`;
}

type InfoCardProps = { title: string; value: string; description: string; icon: React.ReactNode };

function InfoCard({ title, value, description, icon }: InfoCardProps) {
  return (
    <article style={{ minHeight:"126px", padding:"17px", borderRadius:"15px", border:"1px solid rgba(75,107,132,0.13)", background:"linear-gradient(155deg, rgba(255,255,255,0.98), rgba(247,252,255,0.90))", boxShadow:"0 7px 20px rgba(18,48,71,0.045)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"11px" }}>
        <div style={{ width:"40px", height:"40px", flex:"0 0 40px", display:"grid", placeItems:"center", borderRadius:"11px", border:"1px solid rgba(25,119,197,0.16)", background:"#eaf4fe", color:"#1977c5" }}>{icon}</div>
        <div style={{ minWidth:0 }}>
          <span style={{ display:"block", color:"#748797", fontSize:"9px", fontWeight:800, letterSpacing:"0.03em", textTransform:"uppercase" }}>{title}</span>
          <strong style={{ display:"block", marginTop:"3px", color:"#10233d", fontSize:"20px", fontWeight:850, letterSpacing:"-0.02em" }}>{value}</strong>
        </div>
      </div>
      <p style={{ margin:"13px 0 0", color:"#718595", fontSize:"10px", lineHeight:1.5 }}>{description}</p>
    </article>
  );
}

export default function BackupRecovery() {
  const [data, setData] = useState<BackupRecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      setData(await getBackupRecovery());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível verificar o estado dos backups.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => void loadData(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return <section style={{ width:"min(100% - 48px, 1540px)", margin:"22px auto 0", padding:"22px", borderRadius:"17px", border:"1px solid rgba(75,107,132,0.14)", background:"linear-gradient(155deg, rgba(255,255,255,0.95), rgba(247,252,255,0.86))", color:"#203446", boxShadow:"0 10px 28px rgba(18,48,71,0.055)" }}>A verificar backups...</section>;
  }

  const status = data?.status ?? "error";
  const protectedStatus = status === "protected";
  const warningStatus = status === "warning";
  const missingStatus = status === "missing";
  const StatusIcon = protectedStatus ? CheckCircle2 : warningStatus ? TriangleAlert : missingStatus ? Archive : XCircle;
  const statusBackground = protectedStatus ? "#e8f7f0" : warningStatus ? "#fff7df" : "#fff0ef";
  const statusColor = protectedStatus ? "#137c59" : warningStatus ? "#9a6700" : "#b42318";
  const statusBorder = protectedStatus ? "rgba(21,148,103,0.22)" : warningStatus ? "rgba(202,138,4,0.22)" : "rgba(239,68,68,0.18)";
  const latest = data?.backup.latest ?? null;

  return (
    <section style={{ width:"min(100% - 48px, 1540px)", margin:"22px auto 0", padding:"22px", borderRadius:"17px", border:"1px solid rgba(75,107,132,0.14)", background:"linear-gradient(155deg, rgba(255,255,255,0.96), rgba(247,252,255,0.88))", color:"#10233d", boxShadow:"0 10px 28px rgba(18,48,71,0.055)", backdropFilter:"blur(16px) saturate(135%)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:"22px", flexWrap:"wrap", marginBottom:"18px" }}>
        <div>
          <span style={{ color:"#0878bd", fontSize:"9px", fontWeight:800, letterSpacing:"0.12em" }}>PROTEÇÃO DE DADOS</span>
          <h2 style={{ margin:"5px 0 4px", color:"#10233d", fontSize:"24px", fontWeight:750, letterSpacing:"-0.025em" }}>Backup e Recuperação</h2>
          <p style={{ margin:0, color:"#6a7e90", fontSize:"12px", lineHeight:1.5 }}>Proteção da base Neon com backups externos validados no Cloudflare R2.</p>
        </div>
        <button type="button" onClick={() => void loadData(true)} disabled={refreshing} style={{ minHeight:"38px", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:"7px", padding:"8px 13px", borderRadius:"10px", border:"1px solid rgba(75,107,132,0.17)", background:"linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,248,253,0.96))", color:"#24445d", boxShadow:"0 3px 10px rgba(18,48,71,0.04)", cursor:refreshing ? "default" : "pointer", fontSize:"11px", fontWeight:750 }}>
          <RefreshCw size={14} />{refreshing ? "A verificar..." : "Verificar agora"}
        </button>
      </div>

      {error && <div style={{ marginBottom:"16px", padding:"11px 13px", borderRadius:"10px", border:"1px solid rgba(239,68,68,0.16)", background:"#fff0ef", color:"#b42318", fontSize:"11px" }}>{error}</div>}

      {data && <>
        <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"14px", padding:"16px 17px", borderRadius:"15px", border:`1px solid ${statusBorder}`, background:statusBackground }}>
          <div style={{ width:"44px", height:"44px", flex:"0 0 44px", display:"grid", placeItems:"center", borderRadius:"12px", background:"rgba(255,255,255,0.68)", color:statusColor }}><StatusIcon size={24} /></div>
          <div>
            <strong style={{ display:"block", color:statusColor, fontSize:"17px", fontWeight:850 }}>{data.status_label}</strong>
            <span style={{ display:"block", marginTop:"3px", color:"#657b8b", fontSize:"10px" }}>
              {latest ? <>Último backup há {formatAge(latest.age_hours)} · {data.backup.backup_count} {data.backup.backup_count === 1 ? "backup disponível" : "backups disponíveis"}</> : "Nenhum backup externo foi encontrado."}
            </span>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(210px, 1fr))", gap:"10px" }}>
          <InfoCard title="Último backup" value={latest ? formatAge(latest.age_hours) : "Sem backup"} description={latest ? `${formatDateTime(latest.last_modified)} · ${formatBytes(latest.size_bytes)}` : "Não foi encontrado qualquer dump no R2."} icon={<DatabaseBackup size={21} />} />
          <InfoCard title="Backups disponíveis" value={data.backup.backup_count.toLocaleString("pt-PT")} description={`Retenção automática de ${data.backup.retention_days} dias no Cloudflare R2.`} icon={<HardDrive size={21} />} />
          <InfoCard title="Backup automático" value={`${data.backup.schedule_utc} UTC`} description={`Executado diariamente por ${data.backup.provider}.`} icon={<Clock3 size={21} />} />
          <InfoCard title="Instant Restore Neon" value={data.neon.instant_restore ? `${data.neon.history_hours} horas` : "Indisponível"} description={data.neon.instant_restore ? "Recuperação nativa para incidentes recentes no Neon." : "A recuperação instantânea não está disponível."} icon={<History size={21} />} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:"10px", marginTop:"10px" }}>
          <div style={{ padding:"14px 15px", borderRadius:"13px", border:"1px solid rgba(21,148,103,0.13)", background:"rgba(232,247,240,0.52)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"#137c59" }}><ShieldCheck size={17} /><strong style={{ fontSize:"11px" }}>Backup validado antes do armazenamento</strong></div>
            <p style={{ margin:"7px 0 0 25px", color:"#657b8b", fontSize:"9px", lineHeight:1.5 }}>Cada dump é verificado através de {data.backup.validation} antes de ser enviado para o R2.</p>
          </div>
          <div style={{ padding:"14px 15px", borderRadius:"13px", border:"1px solid rgba(25,119,197,0.13)", background:"rgba(234,244,254,0.52)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"#1977c5" }}><Archive size={17} /><strong style={{ fontSize:"11px" }}>Recuperação em duas camadas</strong></div>
            <p style={{ margin:"7px 0 0 25px", color:"#657b8b", fontSize:"9px", lineHeight:1.5 }}>Instant Restore Neon para as últimas {data.neon.history_hours} horas + backups externos R2 durante {data.backup.retention_days} dias.</p>
          </div>
        </div>

        {latest && <div style={{ marginTop:"12px", padding:"11px 13px", borderRadius:"11px", border:"1px solid rgba(75,107,132,0.10)", background:"rgba(248,252,254,0.68)" }}>
          <span style={{ display:"block", color:"#7b8e9d", fontSize:"8px", fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase" }}>Último ficheiro validado</span>
          <strong style={{ display:"block", marginTop:"4px", color:"#40576a", fontSize:"9px", fontWeight:700, wordBreak:"break-all" }}>{latest.filename}</strong>
        </div>}

        <div style={{ display:"flex", justifyContent:"space-between", gap:"14px", flexWrap:"wrap", marginTop:"12px", paddingTop:"10px", borderTop:"1px solid rgba(75,107,132,0.10)", color:"#8495a3", fontSize:"9px" }}>
          <span>Monitorização: <strong>somente leitura</strong></span>
          <span>Atualização automática a cada 60 segundos.</span>
          <span>Verificação: <strong>{formatDateTime(data.checked_at)}</strong></span>
        </div>
      </>}
    </section>
  );
}
