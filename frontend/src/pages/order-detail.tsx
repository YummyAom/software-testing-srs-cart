import { useParams } from "react-router-dom"
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
      >
        {order ? (
          <Panel title="ข้อมูลคำสั่งซื้อ">
            <div className="order-detail-topline">
              <div className="order-reference order-reference--plain">
                <span>หมายเลขคำสั่งซื้อ</span>
                <strong data-testid="order-detail-id">{order.id}</strong>
              </div>
              <OrderStatusPill status={order.status} testId="order-detail-status" />
            </div>
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
                      <td data-label="สินค้า">{line.name}</td>
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
          </Panel>
        ) : null}
      </PageScaffold>
    </AppShell>
  )
}
