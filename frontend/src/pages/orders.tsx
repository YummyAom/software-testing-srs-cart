import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, OrderStatusPill, PageScaffold, Panel } from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import { getOrdersApi, OrderSummary } from "@/src/lib/api-client"

export default function OrdersPage() {
  const { accessToken } = useAuth()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!accessToken) return
      try {
        setLoading(true)
        setError(null)
        const data = await getOrdersApi(accessToken)
        setOrders(data)
      } catch (err: any) {
        setError(err.message || "ไม่สามารถโหลดประวัติคำสั่งซื้อได้")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accessToken])

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  return (
    <AppShell role="customer" activePage="orders">
      <PageScaffold
        pageTestId="page-orders"
        title="คำสั่งซื้อของฉัน"
        description="รายการคำสั่งซื้อเรียงจากใหม่ไปเก่า เปิดดูรายละเอียดของแต่ละรายการได้"
      >
        {error && (
          <div
            className="demo-scaffold-banner"
            data-testid="app-message"
            data-kind="error"
            data-code="ORDER_UNAVAILABLE"
            role="alert"
            style={{
              padding: "1rem",
              marginBottom: "1.5rem",
              borderRadius: "6px",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #f87171",
            }}
          >
            <p>{error}</p>
          </div>
        )}

        <Panel title="ประวัติคำสั่งซื้อ">
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              กำลังโหลดประวัติคำสั่งซื้อ...
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              ไม่มีประวัติคำสั่งซื้อ
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">รายการคำสั่งซื้อ</caption>
                <thead>
                  <tr>
                    <th scope="col">หมายเลขคำสั่งซื้อ</th>
                    <th scope="col">วันที่</th>
                    <th scope="col">สถานะ</th>
                    <th scope="col">ยอดสุทธิ</th>
                    <th scope="col">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.orderId} data-testid={`order-row-${order.orderId}`}>
                      <td data-label="หมายเลขคำสั่งซื้อ">
                        <strong>{order.orderId}</strong>
                      </td>
                      <td data-label="วันที่">{formatDate(order.createdAt)}</td>
                      <td data-label="สถานะ">
                        <OrderStatusPill status={order.status} testId="order-status" />
                      </td>
                      <td data-label="ยอดสุทธิ">
                        <MoneyValue amount={order.netTotal} testId="order-total" />
                      </td>
                      <td data-label="รายละเอียด">
                        <Link
                          className="text-link"
                          to={`/orders/${order.orderId}`}
                          data-testid="order-view"
                          aria-label={`ดูรายละเอียดคำสั่งซื้อ ${order.orderId}`}
                        >
                          ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </PageScaffold>
    </AppShell>
  )
}
