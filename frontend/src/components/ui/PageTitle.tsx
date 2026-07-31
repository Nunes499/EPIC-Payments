import type { ReactNode } from "react";

type PageTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: PageTitleProps) {
  return (
    <section className="page-title">
      <div>
        {eyebrow ? <span className="section-label">{eyebrow}</span> : null}

        <h2>{title}</h2>

        {description ? <p>{description}</p> : null}
      </div>

      {action ? <div className="page-title-action">{action}</div> : null}
    </section>
  );
}