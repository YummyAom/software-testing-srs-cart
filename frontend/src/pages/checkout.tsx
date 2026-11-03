import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, OrderStatusPill, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import {
  cancelCheckoutApi,
  getAuthMeApi,
  getOrderApi,
  Order,
  payFailApi,
  paySuccessApi,
} from "@/src/lib/api-client"

export default function CheckoutPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(true)
  const [message, setMessage] = useState<{ kind: "error" | "info" | "success"; text: string } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { accessToken } = useAuth()

  useEffect(() => {
    async function load() {
      if (!accessToken) return
      try {
        setLoadingOrder(true)
        let orderId = location.state?.orderId
        if (!orderId) {
          const me = await getAuthMeApi(accessToken)
          orderId = me.currentOrderId
        }
        if (orderId) {
          const ord = await getOrderApi(accessToken, orderId)
          setOrder(ord)
        } else {
          setMessage({ kind: "error", text: "ไม่พบคำสั่งซื้อที่รอชำระเงิน" })
        }
      } catch (err: any) {
        setMessage({ kind: "error", text: err.message || "ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้" })
      } finally {
        setLoadingOrder(false)
      }
    }
    load()
  }, [accessToken, location.state])

  const handlePaySuccess = async () => {
    if (!order) return
    setIsLoading(true)
    setMessage(null)
    try {
      await paySuccessApi(order.orderId)
      navigate("/success", { state: { orderId: order.orderId } })
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "เกิดข้อผิดพลาดในการชำระเงิน" })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePayFail = async () => {
    if (!order) return
    setIsLoading(true)
    setMessage(null)
    try {
      const response = await payFailApi(order.orderId)
      const infoText = response.messages?.[0]?.message || "การชำระเงินล้มเหลว กรุณาลองใหม่"
      setMessage({ kind: "info", text: infoText })
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "การชำระเงินล้มเหลว กรุณาลองใหม่" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelCheckout = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      if (accessToken) {
        await cancelCheckoutApi(accessToken)
      }
      navigate("/cart")
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ" })
    } finally {
      setIsLoading(false)
    }
  }

  if (loadingOrder) {
    return (
      <AppShell role="customer" activePage="checkout">
        <PageScaffold pageTestId="page-checkout" title="ตรวจสอบคำสั่งซื้อ">
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
            กำลังโหลดข้อมูลคำสั่งซื้อ...
          </div>
        </PageScaffold>
      </AppShell>
    )
  }

  if (!order) {
    return (
      <AppShell role="customer" activePage="checkout">
        <PageScaffold
          pageTestId="page-checkout"
          title="ตรวจสอบคำสั่งซื้อ"
          message={message?.text || "ไม่พบคำสั่งซื้อที่รอชำระเงิน"}
          messageKind="error"
          messageCode="ORDER_NOT_FOUND"
        >
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate("/cart")}
          >
            กลับไปยังรถเข็น
          </button>
        </PageScaffold>
      </AppShell>
    )
  }

  return (
    <AppShell role="customer" activePage="checkout">
      <PageScaffold
        pageTestId="page-checkout"
        title="ตรวจสอบคำสั่งซื้อ"
        description="ตรวจสอบ snapshot ของรายการและยอดชำระก่อนชำระเงิน"
      >
        {message && (
          <div
            className="demo-scaffold-banner"
            data-testid="app-message"
            data-kind={message.kind}
            data-code=""
            role={message.kind === "error" ? "alert" : "status"}
            aria-live="polite"
            style={{
              padding: "1rem",
              marginBottom: "1.5rem",
              borderRadius: "6px",
              backgroundColor: message.kind === "error" ? "#fee2e2" : "#fef3c7",
              color: message.kind === "error" ? "#991b1b" : "#92400e",
              border: `1px solid ${message.kind === "error" ? "#f87171" : "#fcd34d"}`,
              fontWeight: 500,
            }}
          >
            {message.text}
          </div>
        )}

        <div className="checkout-layout">
          <Panel title="รายการสินค้าในคำสั่งซื้อ">
            <div className="order-reference">
              <span>หมายเลขคำสั่งซื้อ</span>
              <strong data-testid="checkout-order-id">{order.orderId}</strong>
            </div>
            <div className="table-scroll">
              <table className="data-table order-lines-table">
                <caption className="sr-only">รายการสินค้าใน snapshot คำสั่งซื้อ</caption>
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
                    <tr key={line.productId} data-testid={`checkout-line-${line.productId}`}>
                      <td data-label="สินค้า">
                        <strong>{line.name}</strong>
                      </td>
                      <td data-label="ราคาต่อชิ้น">
                        <MoneyValue amount={line.unitPrice} />
                      </td>
                      <td data-label="จำนวน">
                        <QuantityValue value={line.quantity} suffix="ชิ้น" />
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

          <aside className="checkout-summary-column" aria-label="สรุปยอดชำระและชำระเงิน">
            <Panel title="สรุปยอดชำระ">
              <div className="order-status-badge-block">
                <span className="field-caption">สถานะคำสั่งซื้อ</span>
                <OrderStatusPill status={order.status} testId="checkout-order-status" />
              </div>

              <dl className="totals-list">
                <div className="totals-row">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd>
                    <MoneyValue amount={order.subtotal} testId="checkout-subtotal" />
                  </dd>
                </div>
                <div className="totals-row">
                  <dt>ส่วนลด</dt>
                  <dd>
                    <MoneyValue amount={order.discount} testId="checkout-discount" />
                  </dd>
                </div>
                <div className="totals-row">
                  <dt>ค่าจัดส่ง</dt>
                  <dd>
                    <MoneyValue amount={order.shippingFee} testId="checkout-shipping" />
                  </dd>
                </div>
                <div className="totals-row totals-row-net">
                  <dt>ยอดชำระสุทธิ</dt>
                  <dd>
                    <MoneyValue amount={order.netTotal} testId="checkout-total" />
                  </dd>
                </div>
              </dl>

              <div className="button-stack checkout-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  data-testid="cancel-checkout-button"
                  disabled={isLoading}
                  onClick={handleCancelCheckout}
                >
                  ยกเลิกและกลับไปแก้ไขรถเข็น
                </button>
              </div>

              {/* DC-3.3: gateway simulator buttons in development (Vite dev server) and test builds. */}
              {(import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "test") && (
              <div
                style={{
                  marginTop: "1.5rem",
                  padding: "1rem",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "8px",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>
                  เครื่องมือจำลองผลการชำระเงิน (Test Gateway Simulator)
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="button button-primary"
                    data-testid="gateway-pay-success"
                    disabled={isLoading}
                    onClick={handlePaySuccess}
                    style={{ flex: 1 }}
                  >
                    จำลองชำระสำเร็จ
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    data-testid="gateway-pay-fail"
                    disabled={isLoading}
                    onClick={handlePayFail}
                    style={{ flex: 1, backgroundColor: "#ef4444", color: "#ffffff" }}
                  >
                    จำลองชำระไม่สำเร็จ
                  </button>
                </div>
              </div>
              )}
            </Panel>
          </aside>
        </div>
      </PageScaffold>
    </AppShell>
  )
}
