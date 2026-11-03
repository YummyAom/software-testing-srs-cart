import { useEffect, useState } from "react"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, StatusPill } from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import { ApiError, Coupon, getAdminCouponsApi, toggleAdminCouponStatusApi } from "@/src/lib/api-client"

type PageMessage = { kind: "error" | "notice" | "info"; text: string; code: string }

const errorCode = (err: unknown) => (err instanceof ApiError && err.code ? err.code : "")

export default function AdminCouponsPage() {
  const { accessToken } = useAuth()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingCode, setTogglingCode] = useState<string | null>(null)
  const [message, setMessage] = useState<PageMessage | null>(null)

  const loadCoupons = async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await getAdminCouponsApi(accessToken)
      setCoupons(data)
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถโหลดข้อมูลคูปองได้", code: errorCode(err) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCoupons()
  }, [accessToken])

  const handleToggleStatus = async (coupon: Coupon) => {
    if (!accessToken) return
    const nextStatus = coupon.status === "active" ? "inactive" : "active"
    try {
      setTogglingCode(coupon.code)
      setMessage(null)
      const updatedCoupons = await toggleAdminCouponStatusApi(accessToken, coupon.code, nextStatus)
      setCoupons(updatedCoupons)
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถเปลี่ยนสถานะคูปองได้", code: errorCode(err) })
    } finally {
      setTogglingCode(null)
    }
  }

  return (
    <AppShell role="admin" activePage="admin-coupons">
      <PageScaffold
        pageTestId="page-admin-coupons"
        title="จัดการคูปอง"
        description="ตรวจสอบรหัส ส่วนลดขั้นต่ำ และสถานะการใช้งาน"
      >
        {message && (
          <div
            className="demo-scaffold-banner"
            data-testid="app-message"
            data-kind={message.kind}
            data-code={message.code}
            role={message.kind === "error" ? "alert" : "status"}
            aria-live="polite"
            style={{
              padding: "1rem",
              marginBottom: "1.5rem",
              borderRadius: "6px",
              backgroundColor: message.kind === "error" ? "#fee2e2" : "#f0fdf4",
              borderColor: message.kind === "error" ? "#f87171" : "#86efac",
              color: message.kind === "error" ? "#991b1b" : "#166534",
            }}
          >
            <p>{message.text}</p>
          </div>
        )}

        <Panel
          title="คูปองทั้งหมด"
          description={loading ? "กำลังโหลดข้อมูลคูปอง..." : `พบคูปองทั้งหมด ${coupons.length} รายการ`}
        >
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">รายการคูปอง</caption>
              <thead>
                <tr>
                  <th scope="col">รหัสคูปอง</th>
                  <th scope="col">ส่วนลด</th>
                  <th scope="col">ยอดขั้นต่ำ</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.code} data-testid={`admin-coupon-row-${coupon.code}`}>
                    <td data-label="รหัสคูปอง">
                      <strong>{coupon.code}</strong>
                    </td>
                    <td data-label="ส่วนลด">
                      <span data-testid="admin-coupon-percent" data-value={coupon.percent}>
                        {coupon.percent}%
                      </span>
                    </td>
                    <td data-label="ยอดขั้นต่ำ">
                      <MoneyValue amount={coupon.minSpend} testId="admin-coupon-min-spend" />
                    </td>
                    <td data-label="สถานะ">
                      <StatusPill
                        status={coupon.status}
                        label={coupon.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                        tone={coupon.status === "active" ? "positive" : "neutral"}
                        testId="admin-coupon-status"
                      />
                    </td>
                    <td data-label="จัดการ">
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        data-testid="admin-coupon-toggle-status"
                        disabled={togglingCode === coupon.code}
                        onClick={() => handleToggleStatus(coupon)}
                      >
                        {coupon.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </PageScaffold>
    </AppShell>
  )
}
