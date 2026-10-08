import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, OrderStatusPill, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { demoOrders } from "@/lib/commerce-demo-data"

const checkoutOrder = demoOrders[0]

export default function CheckoutPage() {
  return (
    <AppShell role="customer" activePage="checkout">
      <PageScaffold
        pageTestId="page-checkout"
        title="ตรวจสอบคำสั่งซื้อ"
        description="ตรวจสอบ snapshot ของรายการและยอดชำระก่อนชำระเงิน"
      >
        <div className="checkout-layout">
          <Panel title="รายการสินค้าในคำสั่งซื้อ">
            <div className="order-reference">
              <span>หมายเลขคำสั่งซื้อ</span>
              <strong data-testid="checkout-order-id">{checkoutOrder.id}</strong>
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
                  {checkoutOrder.lines.map((line) => (
                    <tr key={line.productId}>
                      <td data-label="สินค้า">{line.name}</td>
                      <td data-label="ราคาต่อชิ้น">
                        <MoneyValue amount={line.unitPrice} />
                      </td>
                      <td data-label="จำนวน">
                        <QuantityValue value={line.quantity} suffix="ชิ้น" />
                      </td>
                      <td data-label="รวมรายการ">
                        <MoneyValue amount={line.lineTotal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="snapshot-meta">
              <div>
                <span>พื้นที่จัดส่ง</span>
                <strong>ในเมือง</strong>
              </div>
              <div>
                <span>รูปแบบการจัดส่ง</span>
                <strong>ปกติ</strong>
              </div>
              <div>
                <span>คูปอง</span>
                <strong>{checkoutOrder.couponCode || "ไม่มี"}</strong>
              </div>
            </div>
          </Panel>

          <aside className="checkout-side-column" aria-label="ยอดชำระและการดำเนินการ">
            <Panel title="สรุปยอดชำระ">
              <dl className="totals-list">
                <div className="totals-row">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd>
                    <MoneyValue amount={checkoutOrder.subtotal} testId="checkout-subtotal" />
                  </dd>
                </div>
                <div className="totals-row">
                  <dt>ส่วนลด</dt>
                  <dd>
                    <MoneyValue amount={checkoutOrder.discount} testId="checkout-discount" />
                  </dd>
                </div>
                <div className="totals-row">
                  <dt>ค่าจัดส่ง</dt>
                  <dd>
                    <MoneyValue amount={checkoutOrder.shipping} testId="checkout-shipping" />
                  </dd>
                </div>
                <div className="totals-row totals-row--grand">
                  <dt>ยอดชำระสุทธิ</dt>
                  <dd>
                    <MoneyValue amount={checkoutOrder.total} testId="checkout-total" />
                  </dd>
                </div>
              </dl>
              <div className="button-stack">
                <button
                  type="button"
                  className="button button-primary button-full"
                  data-testid="gateway-pay-success"
                  disabled
                >
                  จำลองชำระสำเร็จ (test)
                </button>
                <button
                  type="button"
                  className="button button-secondary button-full"
                  data-testid="gateway-pay-fail"
                  disabled
                >
                  จำลองชำระไม่สำเร็จ (test)
                </button>
                <button
                  type="button"
                  className="button button-quiet button-full"
                  data-testid="cancel-checkout-button"
                  disabled
                >
                  ยกเลิกคำสั่งซื้อ
                </button>
              </div>
              <p className="panel-footnote">ปุ่มชำระเงินและยกเลิกยังไม่เชื่อมต่อ gateway หรือ API</p>
            </Panel>
            <div className="inline-status">
              <OrderStatusPill status={checkoutOrder.status} />
              <span>สถานะในข้อมูลตัวอย่าง</span>
            </div>
          </aside>
        </div>
      </PageScaffold>
    </AppShell>
  )
}
