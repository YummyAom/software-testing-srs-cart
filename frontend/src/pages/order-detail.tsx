import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { AppShell } from "@/components/commerce/shell"
import {
  MoneyValue,
  OrderStatusPill,
  PageScaffold,
  Panel,
  QuantityValue,
} from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import { getOrderApi, Order } from "@/src/lib/api-client"

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { accessToken } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!accessToken || !orderId) return
      try {
        setLoading(true)
        setError(null)
        const data = await getOrderApi(accessToken, orderId)
        setOrder(data)
      } catch (err: any) {
        setError(err.message || "ไม่พบคำสั่งซื้อ")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accessToken, orderId])

  const formatDate = (iso?: string) => {
    if (!iso) return ""
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
        pageTestId="page-order-detail"
        title="รายละเอียดคำสั่งซื้อ"
        description={order ? `คำสั่งซื้อ ${order.orderId}` : undefined}
        message={error ? "ไม่พบคำสั่งซื้อ" : undefined}
        messageKind={error ? "error" : "info"}
        messageCode={error ? "ORDER_NOT_FOUND" : ""}
        className="max-w-5xl mx-auto w-full"
      >
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
            กำลังโหลดรายละเอียดคำสั่งซื้อ...
          </div>
        ) : order ? (
          <div className="order-detail-layout">
            <div className="order-detail-main-column">
              <Panel
                title="รายการสินค้าในคำสั่งซื้อ"
                description={
                  <div className="order-reference order-reference--plain mt-1">
                    <span>หมายเลขคำสั่งซื้อ: </span>
                    <strong data-testid="order-detail-id">{order.orderId}</strong>
                  </div>
                }
              >
                <div className="table-scroll">
                  <table className="data-table order-lines-table">
                    <caption className="sr-only">รายการสินค้าในคำสั่งซื้อ</caption>
                    <thead>
                      <tr>
                        <th scope="col">สินค้า</th>
                        <th scope="col">ราคาต่อชิ้น</th>
                        <th scope="col">จำนวน</th>
                        <th scope="col">รวมรายการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line) => (
                        <tr key={line.productId} data-testid={`order-line-${line.productId}`}>
                          <td data-label="สินค้า">
                            <strong>{line.name}</strong>
                          </td>
                          <td data-label="ราคาต่อชิ้น">
                            <MoneyValue amount={line.unitPrice} testId="order-line-unit-price" />
                          </td>
                          <td data-label="จำนวน">
                            <QuantityValue value={line.quantity} suffix="ชิ้น" testId="order-line-qty" />
                          </td>
                          <td data-label="รวมรายการ">
                            <MoneyValue amount={line.unitPrice * line.quantity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <aside className="order-detail-side-column" aria-label="สรุปยอดเงินและสถานะคำสั่งซื้อ">
              <Panel title="สรุปคำสั่งซื้อและสถานะ">
                <div className="order-status-summary-block">
                  <span className="field-caption">สถานะคำสั่งซื้อ</span>
                  <OrderStatusPill status={order.status} testId="order-detail-status" />
                </div>

                <div className="order-meta-details">
                  <div className="order-meta-row">
                    <span className="field-caption">วันที่สั่งซื้อ</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  {order.couponCode ? (
                    <div className="order-meta-row">
                      <span className="field-caption">คูปองที่ใช้</span>
                      <strong>{order.couponCode}</strong>
                    </div>
                  ) : null}
                </div>

                <dl className="totals-list detail-totals">
                  <div className="totals-row">
                    <dt>ยอดรวมสินค้า</dt>
                    <dd>
                      <MoneyValue amount={order.subtotal} testId="order-detail-subtotal" />
                    </dd>
                  </div>
                  <div className="totals-row">
                    <dt>ส่วนลด</dt>
                    <dd>
                      <MoneyValue amount={order.discount} testId="order-detail-discount" />
                    </dd>
                  </div>
                  <div className="totals-row">
                    <dt>ค่าจัดส่ง</dt>
                    <dd>
                      <MoneyValue amount={order.shippingFee} testId="order-detail-shipping" />
                    </dd>
                  </div>
                  <div className="totals-row totals-row--grand">
                    <dt>ยอดชำระสุทธิ</dt>
                    <dd>
                      <MoneyValue amount={order.netTotal} testId="order-detail-total" />
                    </dd>
                  </div>
                </dl>

                <div className="order-back-nav mt-6">
                  <Link to="/orders" className="button button-secondary w-full flex items-center justify-center gap-2">
                    <ArrowLeft size={16} />
                    <span>กลับไปหน้ารายการคำสั่งซื้อ</span>
                  </Link>
                </div>
              </Panel>
            </aside>
          </div>
        ) : (
          <div className="order-back-nav mt-6">
            <Link to="/orders" className="button button-secondary">
              <ArrowLeft size={16} />
              <span>กลับไปหน้ารายการคำสั่งซื้อ</span>
            </Link>
          </div>
        )}
      </PageScaffold>
    </AppShell>
  )
}
