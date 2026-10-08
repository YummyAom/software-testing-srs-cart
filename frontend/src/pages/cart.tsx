import { DraftNumberInput } from "@/components/commerce/draft-number-input"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { cartPreview, formatInteger } from "@/lib/commerce-demo-data"

export default function CartPage() {
  return (
    <AppShell role="customer" activePage="cart">
      <PageScaffold
        pageTestId="page-cart"
        title="รถเข็น"
        description="ตรวจสอบรายการสินค้า จำนวน และเงื่อนไขการจัดส่ง"
      >
        <div className="cart-layout">
          <Panel
            title="รายการในรถเข็น"
            description={
              <span data-value={cartPreview.lines.length}>
                {formatInteger(cartPreview.lines.length)} รายการในตัวอย่างนี้
              </span>
            }
          >
            <div className="table-scroll">
              <table className="data-table cart-table">
                <caption className="sr-only">รายการสินค้าในรถเข็นตัวอย่าง</caption>
                <thead>
                  <tr>
                    <th scope="col">สินค้า</th>
                    <th scope="col">ราคาต่อชิ้น</th>
                    <th scope="col">จำนวน</th>
                    <th scope="col">สถานะสินค้า</th>
                    <th scope="col">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {cartPreview.lines.map((line) => (
                    <tr key={line.productId} data-testid={`cart-line-${line.productId}`}>
                      <td data-label="สินค้า">
                        <strong data-testid="cart-line-name">{line.name}</strong>
                      </td>
                      <td data-label="ราคาต่อชิ้น">
                        <MoneyValue amount={line.unitPrice} testId="cart-line-unit-price" />
                      </td>
                      <td data-label="จำนวน">
                        <div className="cart-quantity-cell">
                          <QuantityValue value={line.quantity} testId="cart-line-qty" />
                          <label className="sr-only" htmlFor={`cart-qty-${line.productId}`}>
                            จำนวน {line.name}
                          </label>
                          <DraftNumberInput
                            id={`cart-qty-${line.productId}`}
                            data-testid="cart-line-qty-input"
                            className="form-control form-control--compact"
                            initialValue={line.quantity}
                            min={1}
                            max={10}
                            step={1}
                            inputMode="numeric"
                          />
                        </div>
                      </td>
                      <td data-label="สถานะสินค้า">
                        <span
                          className={`availability-label ${line.available ? "availability-label--available" : "availability-label--unavailable"}`}
                          data-testid="cart-line-availability"
                          data-available={line.available ? "true" : "false"}
                        >
                          {line.available ? "พร้อมจำหน่าย" : "สินค้าหมด"}
                        </span>
                      </td>
                      <td data-label="จัดการ">
                        <div className="button-row">
                          <button
                            type="button"
                            className="button button-secondary button-small"
                            data-testid="cart-line-update"
                            disabled
                          >
                            อัปเดต
                          </button>
                          <button
                            type="button"
                            className="button button-quiet button-small"
                            data-testid="cart-line-remove"
                            disabled
                          >
                            นำออก
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <aside className="cart-side-column" aria-label="สรุปรายการและการจัดส่ง">
            <Panel title="คูปอง">
              <div className="field-block">
                <span className="field-caption">คูปองที่ใช้</span>
                <span className="coupon-current" data-testid="cart-coupon-code">
                  {cartPreview.couponCode || "ยังไม่ได้ใช้คูปอง"}
                </span>
              </div>
              <div className="field-block">
                <label htmlFor="coupon-input">รหัสคูปอง</label>
                <input
                  id="coupon-input"
                  data-testid="coupon-input"
                  className="form-control"
                  type="text"
                  placeholder="กรอกรหัสคูปอง"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className="button button-secondary button-full"
                data-testid="coupon-apply"
                disabled
              >
                ใช้คูปอง
              </button>
            </Panel>

            <Panel title="การจัดส่ง">
              <div className="field-stack">
                <div className="field-block">
                  <label htmlFor="zone-select">พื้นที่จัดส่ง</label>
                  <select id="zone-select" data-testid="zone-select" className="form-control" defaultValue="inCity">
                    <option value="inCity">ในเมือง</option>
                    <option value="upcountry">ต่างจังหวัด</option>
                    <option value="remote">พื้นที่ห่างไกล</option>
                  </select>
                </div>
                <div className="field-block">
                  <label htmlFor="speed-select">รูปแบบการจัดส่ง</label>
                  <select id="speed-select" data-testid="speed-select" className="form-control" defaultValue="standard">
                    <option value="standard">ปกติ</option>
                    <option value="express">ด่วน</option>
                  </select>
                </div>
              </div>
            </Panel>

            <Panel title="ยอดรวม">
              <dl className="totals-list">
                <div className="totals-row totals-row--grand">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd>
                    <MoneyValue amount={cartPreview.subtotal} testId="cart-subtotal" />
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="button button-primary button-full checkout-action"
                data-testid="checkout-button"
                disabled
              >
                ดำเนินการชำระเงิน
              </button>
              <p className="panel-footnote">การดำเนินการจะเปิดใช้หลังเชื่อมต่อ API</p>
            </Panel>
          </aside>
        </div>
      </PageScaffold>
    </AppShell>
  )
}
