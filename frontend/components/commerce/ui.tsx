import type { ReactNode } from "react"
import type { DemoOrderStatus } from "@/lib/commerce-demo-data"
import { formatTHB, scaffoldNotice } from "@/lib/commerce-demo-data"

type MessageKind = "error" | "notice" | "info"
type StatusTone = "positive" | "warning" | "danger" | "neutral"

type AppMessageProps = {
  kind?: MessageKind
  code?: string
  children: ReactNode
}

export function AppMessage({ kind = "info", code = "", children }: AppMessageProps) {
  return (
    <div
      className={`app-message app-message--${kind}`}
      data-testid="app-message"
      data-kind={kind}
      data-code={code}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <span className="app-message-mark" aria-hidden="true">
        {kind === "error" ? "!" : kind === "notice" ? "i" : "i"}
      </span>
      <p>{children}</p>
    </div>
  )
}

type PageScaffoldProps = {
  pageTestId: string
  title: string
  description?: string
  children: ReactNode
  message?: ReactNode | null | false
  messageKind?: MessageKind
  messageCode?: string
  headingAside?: ReactNode
  className?: string
  titleClassName?: string
}

export function PageScaffold({
  pageTestId,
  title,
  description,
  children,
  message = scaffoldNotice,
  messageKind = "info",
  messageCode = "",
  headingAside,
  className = "",
  titleClassName = "",
}: PageScaffoldProps) {
  return (
    <section
      className={`page-frame ${className}`.trim()}
      data-testid={pageTestId}
      aria-labelledby={`${pageTestId}-heading`}
    >
      {message ? (
        <AppMessage kind={messageKind} code={messageCode}>
          {message}
        </AppMessage>
      ) : null}
      <header className="page-heading">
        <div>
          <h1 id={`${pageTestId}-heading`} className={titleClassName || undefined}>{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {headingAside ? <div className="page-heading-aside">{headingAside}</div> : null}
      </header>
      {children}
    </section>
  )
}

type PanelProps = {
  title?: string
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, description, children, className = "" }: PanelProps) {
  return (
    <section className={`surface-panel ${className}`.trim()}>
      {title || description ? (
        <header className="panel-heading">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  )
}

type MoneyValueProps = {
  amount: number
  testId?: string
  className?: string
}

export function MoneyValue({ amount, testId, className = "" }: MoneyValueProps) {
  return (
    <span className={className || undefined} data-testid={testId} data-value={amount}>
      {formatTHB(amount)}
    </span>
  )
}

type QuantityValueProps = {
  value: number
  suffix?: string
  testId?: string
}

export function QuantityValue({ value, suffix, testId }: QuantityValueProps) {
  return (
    <span data-testid={testId} data-value={value}>
      {new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value)}
      {suffix ? ` ${suffix}` : ""}
    </span>
  )
}

type StatusPillProps = {
  status: string
  label: string
  tone: StatusTone
  testId?: string
}

export function StatusPill({ status, label, tone, testId }: StatusPillProps) {
  return (
    <span
      className={`status-pill status-pill--${tone}`}
      data-testid={testId}
      data-status={status}
    >
      {label}
    </span>
  )
}

const orderStatusPresentation: Record<DemoOrderStatus, { label: string; tone: StatusTone }> = {
  paid: { label: "ชำระแล้ว", tone: "positive" },
  pending: { label: "รอชำระ", tone: "warning" },
  failed: { label: "ชำระไม่สำเร็จ", tone: "danger" },
}

export function OrderStatusPill({ status, testId }: { status: DemoOrderStatus; testId?: string }) {
  const presentation = orderStatusPresentation[status]
  return (
    <StatusPill
      status={status}
      label={presentation.label}
      tone={presentation.tone}
      testId={testId}
    />
  )
}

export function DemoDataLabel({ children }: { children: ReactNode }) {
  return <span className="demo-data-label">{children}</span>
}
