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
import { demoOrders } from "@/lib/commerce-demo-data"

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const order = demoOrders.find((item) => item.id === orderId)

  return (
    <AppShell role="customer" activePage="orders">
      <PageScaffold
        pageTestId="page-order-detail"
        title="รายละเอียดคำสั่งซื้อ"
        description={order ? `คำสั่งซื้อ ${order.id}` : undefined}
        message={order ? undefined : "ไม่พบคำสั่งซื้อ"}
        messageKind={order ? "info" : "error"}
        messageCode={order ? "" : "ORDER_NOT_FOUND"}
        className="max-w-5xl mx-auto w-full"
      >
        {order ? (
          <div className="order-detail-layout">
            {/* ฝั่งซ้าย (ประมาณ 60–65%): รายการสินค้าที่สั่งซื้อ */}
            <div className="order-detail-main-column">
              <Panel
                title="รายการสินค้าในคำสั่งซื้อ"
                description={
                  <div className="order-reference order-reference--plain mt-1">
                    <span>หมายเลขคำสั่งซื้อ: </span>
                    <strong data-testid="order-detail-id">{order.id}</strong>
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
                            <MoneyValue amount={line.lineTotal} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            {/* ฝั่งขวา (ประมาณ 35–40%): การ์ดสรุปยอดเงินและสถานะคำสั่งซื้อ (Order Summary & Status) */}
            <aside className="order-detail-side-column" aria-label="สรุปยอดเงินและสถานะคำสั่งซื้อ">
              <Panel title="สรุปคำสั่งซื้อและสถานะ">
                <div className="order-status-summary-block">
                  <span className="field-caption">สถานะคำสั่งซื้อ</span>
                  <OrderStatusPill status={order.status} testId="order-detail-status" />
                </div>

                <div className="order-meta-details">
                  <div className="order-meta-row">
                    <span className="field-caption">วันที่สั่งซื้อ</span>
                    <span>{order.createdAt}</span>
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
                      <MoneyValue amount={order.shipping} testId="order-detail-shipping" />
                    </dd>
                  </div>
                  <div className="totals-row totals-row--grand">
                    <dt>ยอดชำระสุทธิ</dt>
                    <dd>
                      <MoneyValue amount={order.total} testId="order-detail-total" />
                    </dd>
                  </div>
                </dl>

                <div className="order-detail-back-action">
                  <Link
                    to="/orders"
                    className="button button-secondary button-small button-full"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>กลับไปหน้ารายการคำสั่งซื้อ</span>
                  </Link>
                </div>
              </Panel>
            </aside>
          </div>
        ) : null}
      </PageScaffold>
    </AppShell>
  )
}
