import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, OrderStatusPill, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import {
  continueShoppingApi,
  getAuthMeApi,
  getOrderApi,
  Order,
} from "@/src/lib/api-client"

export default function SuccessPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(true)
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
        }
      } catch {
        // Ignored, handled below
      } finally {
        setLoadingOrder(false)
      }
    }
    load()
  }, [accessToken, location.state])

  const handleContinueShopping = async () => {
    setIsLoading(true)
    try {
      if (accessToken) {
        await continueShoppingApi(accessToken)
      }
      navigate("/products")
    } catch {
      navigate("/products")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppShell role="customer" activePage="success">
      <PageScaffold
        pageTestId="page-success"
        title="คำสั่งซื้อเสร็จสมบูรณ์"
        description="รายละเอียดด้านล่างเป็น snapshot สำหรับหน้าสถานะสำเร็จ"
      >
        <Panel title="รายละเอียดคำสั่งซื้อ">
          {loadingOrder ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              กำลังโหลดข้อมูลคำสั่งซื้อ...
            </div>
          ) : order ? (
            <>
              <div className="success-heading-row">
                <div className="order-reference order-reference--plain">
                  <span>หมายเลขคำสั่งซื้อ</span>
                  <strong data-testid="success-order-id">{order.orderId}</strong>
                </div>
                <OrderStatusPill status={order.status} />
              </div>
              <div className="success-lines">
                {order.lines.map((line) => (
                  <article
                    key={line.productId}
                    className="success-line"
                    data-testid={`success-line-${line.productId}`}
                  >
                    <div className="success-line-name">
                      <strong>{line.name}</strong>
                      <span>
                        <QuantityValue value={line.quantity} suffix="ชิ้น" />
                        <span aria-hidden="true"> · </span>
                        <MoneyValue amount={line.unitPrice} />
                      </span>
                    </div>
                    <MoneyValue amount={line.unitPrice * line.quantity} />
                  </article>
                ))}
              </div>
              <dl className="totals-list success-totals">
                <div className="totals-row">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd>
                    <MoneyValue amount={order.subtotal} testId="success-subtotal" />
                  </dd>
                </div>
                <div className="totals-row">
                  <dt>ส่วนลด</dt>
                  <dd>
                    <MoneyValue amount={order.discount} testId="success-discount" />
                  </dd>
                </div>
                <div className="totals-row">
                  <dt>ค่าจัดส่ง</dt>
                  <dd>
                    <MoneyValue amount={order.shippingFee} testId="success-shipping" />
                  </dd>
                </div>
                <div className="totals-row totals-row--grand">
                  <dt>ยอดชำระสุทธิ</dt>
                  <dd>
                    <MoneyValue amount={order.netTotal} testId="success-total" />
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              ไม่พบข้อมูลคำสั่งซื้อ
            </div>
          )}

          <div className="success-actions">
            <button
              type="button"
              className="button button-primary"
              data-testid="continue-shopping-button"
              onClick={handleContinueShopping}
              disabled={isLoading}
            >
              {isLoading ? "กำลังโหลด..." : "ซื้อสินค้าต่อ"}
            </button>
          </div>
        </Panel>
      </PageScaffold>
    </AppShell>
  )
}
