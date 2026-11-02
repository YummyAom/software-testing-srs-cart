import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, OrderStatusPill, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { demoOrders } from "@/lib/commerce-demo-data"
import { useAuth } from "@/src/context/auth-context"
import { continueShoppingApi } from "@/src/lib/api-client"

const successfulOrder = demoOrders[0]

export default function SuccessPage() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { accessToken } = useAuth()

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
          <div className="success-heading-row">
            <div className="order-reference order-reference--plain">
              <span>หมายเลขคำสั่งซื้อ</span>
              <strong data-testid="success-order-id">{successfulOrder.id}</strong>
            </div>
            <OrderStatusPill status={successfulOrder.status} />
          </div>
          <div className="success-lines">
            {successfulOrder.lines.map((line) => (
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
                <MoneyValue amount={line.lineTotal} />
              </article>
            ))}
          </div>
          <dl className="totals-list success-totals">
            <div className="totals-row">
              <dt>ยอดรวมสินค้า</dt>
              <dd>
                <MoneyValue amount={successfulOrder.subtotal} testId="success-subtotal" />
              </dd>
            </div>
            <div className="totals-row">
              <dt>ส่วนลด</dt>
              <dd>
                <MoneyValue amount={successfulOrder.discount} testId="success-discount" />
              </dd>
            </div>
            <div className="totals-row">
              <dt>ค่าจัดส่ง</dt>
              <dd>
                <MoneyValue amount={successfulOrder.shipping} testId="success-shipping" />
              </dd>
            </div>
            <div className="totals-row totals-row--grand">
              <dt>ยอดชำระสุทธิ</dt>
              <dd>
                <MoneyValue amount={successfulOrder.total} testId="success-total" />
              </dd>
            </div>
          </dl>
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
