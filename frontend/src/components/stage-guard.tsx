import { useEffect, useState, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { getAuthMeApi, type UserState } from "../lib/api-client"

type Stage = NonNullable<UserState["stage"]>

const stagePaths: Record<Stage, string> = {
  cart: "/cart",
  checkout: "/checkout",
  success: "/success",
}

/**
 * DC-2.13: when a Customer opens a stage page that does not match the stage
 * stored by api-server, show the page for the current stage instead.
 */
export function StageGuard({ page, children }: { page: Stage; children: ReactNode }) {
  const { accessToken, user } = useAuth()
  const isCustomer = !!accessToken && user?.role === "customer"
  const [stage, setStage] = useState<Stage | null>(null)
  const [checked, setChecked] = useState(!isCustomer)

  useEffect(() => {
    if (!isCustomer || !accessToken) return
    let cancelled = false
    setChecked(false)
    getAuthMeApi(accessToken)
      .then(me => { if (!cancelled) setStage(me.stage) })
      .catch(() => { if (!cancelled) setStage(null) })
      .finally(() => { if (!cancelled) setChecked(true) })
    return () => { cancelled = true }
  }, [accessToken, isCustomer, page])

  if (!checked) return null
  if (stage && stage !== page) return <Navigate to={stagePaths[stage]} replace />
  return <>{children}</>
}
