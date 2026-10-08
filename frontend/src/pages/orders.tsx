import { Link } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, OrderStatusPill, PageScaffold, Panel } from "@/components/commerce/ui"
import { demoOrders } from "@/lib/commerce-demo-data"

export default function OrdersPage() {
  return (
    <AppShell role="customer" activePage="orders">
      <PageScaffold
        pageTestId="page-orders"
        title="คำสั่งซื้อของฉัน"
        description="รายการตัวอย่างเรียงจากใหม่ไปเก่า เปิดดูรายละเอียดของแต่ละรายการได้"
      >
        <Panel title="ประวัติคำสั่งซื้อ">
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">รายการคำสั่งซื้อตัวอย่าง</caption>
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
                {demoOrders.map((order) => (
                  <tr key={order.id} data-testid={`order-row-${order.id}`}>
                    <td data-label="หมายเลขคำสั่งซื้อ">
                      <strong>{order.id}</strong>
                    </td>
                    <td data-label="วันที่">{order.createdAt}</td>
                    <td data-label="สถานะ">
                      <OrderStatusPill status={order.status} testId="order-status" />
                    </td>
                    <td data-label="ยอดสุทธิ">
                      <MoneyValue amount={order.total} testId="order-total" />
                    </td>
                    <td data-label="รายละเอียด">
                      <Link
                        className="text-link"
                        to={`/orders/${order.id}`}
                        data-testid="order-view"
                        aria-label={`ดูรายละเอียดคำสั่งซื้อ ${order.id}`}
                      >
                        ดูรายละเอียด
                      </Link>
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
