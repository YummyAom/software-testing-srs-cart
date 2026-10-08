import { useState } from "react"
import { AppShell } from "@/components/commerce/shell"
import { cartPreview, formatInteger, formatTHB } from "@/lib/commerce-demo-data"
import { Minus, Package, Plus, Trash2 } from "lucide-react"

export default function CartPage() {
  const [lines, setLines] = useState(cartPreview.lines)
  const [couponCode, setCouponCode] = useState(cartPreview.couponCode || "")
  const [couponInput, setCouponInput] = useState("")
  const [zone, setZone] = useState(cartPreview.zone || "inCity")
  const [speed, setSpeed] = useState(cartPreview.speed || "standard")

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

  const handleUpdateQty = (productId: string, delta: number) => {
    setLines((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const nextQty = Math.min(10, Math.max(1, item.quantity + delta))
          return { ...item, quantity: nextQty }
        }
        return item
      }),
    )
  }

  const handleDirectQtyChange = (productId: string, val: number) => {
    if (isNaN(val)) return
    const bounded = Math.min(10, Math.max(1, val))
    setLines((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: bounded } : item)),
    )
  }

  return (
    <AppShell role="customer" activePage="cart">
      <section className="cart-page-frame" data-testid="page-cart" aria-labelledby="page-cart-heading">
        {/* แถบแจ้งโหมดตัวอย่างสีเหลืองอ่อน (#FFF6DC) */}
        <div
          className="demo-scaffold-banner"
          data-testid="app-message"
          data-kind="info"
          data-code=""
          role="status"
          aria-live="polite"
        >
          <span className="demo-scaffold-mark" aria-hidden="true">
            i
          </span>
          <p>
            โหมดตัวอย่าง: ข้อมูลในหน้านี้ใช้จัดวาง UI เท่านั้น ยังไม่ได้เชื่อมต่อ api-server และปุ่มที่เปลี่ยนข้อมูลยังปิดใช้งาน
          </p>
        </div>

        {/* ส่วนหัวหน้า: h1 + stepper 3 ขั้น */}
        <header className="cart-header-section">
          <div>
            <h1 id="page-cart-heading" className="cart-main-title">
              รถเข็นของคุณ
            </h1>
            <p className="cart-main-subtitle">
              ตรวจสอบรายการสินค้า จำนวน และเงื่อนไขการจัดส่งก่อนชำระเงิน
            </p>
          </div>

          <nav className="cart-stepper" aria-label="ขั้นตอนการสั่งซื้อ">
            <div className="stepper-step stepper-step--active" aria-current="step">
              <span className="stepper-badge">1</span>
              <span className="stepper-text">รถเข็น</span>
            </div>
            <span className="stepper-arrow" aria-hidden="true">
              →
            </span>
            <div className="stepper-step">
              <span className="stepper-badge">2</span>
              <span className="stepper-text">การจัดส่ง</span>
            </div>
            <span className="stepper-arrow" aria-hidden="true">
              →
            </span>
            <div className="stepper-step">
              <span className="stepper-badge">3</span>
              <span className="stepper-text">ชำระเงิน</span>
            </div>
          </nav>
        </header>

        {/* เลย์เอาต์สองคอลัมน์ (grid) */}
        <div className="cart-two-column-layout">
          {/* คอลัมน์ซ้าย */}
          <div className="cart-left-column">
            {/* การ์ดรายการสินค้า */}
            <article className="cart-surface-card" aria-labelledby="items-card-heading">
              <div className="card-top-header">
                <h2 id="items-card-heading" className="card-heading-title">
                  รายการสินค้า
                </h2>
                <span className="card-heading-meta" data-value={lines.length}>
                  {formatInteger(lines.length)} รายการ
                </span>
              </div>

              <div className="cart-item-cards-stack">
                {lines.map((line) => {
                  const lineTotal = line.unitPrice * line.quantity
                  const isOutOfStock = !line.available

                  return (
                    <div
                      key={line.productId}
                      className={`cart-product-row ${isOutOfStock ? "cart-product-row--unavailable" : ""}`}
                      data-testid={`cart-line-${line.productId}`}
                    >
                      {/* รูปสินค้า 88x88 */}
                      <div className="product-media-thumbnail" aria-hidden="true">
                        <Package size={36} strokeWidth={1.6} />
                      </div>

                      {/* รายละเอียดสินค้า */}
                      <div className="product-details-content">
                        <div className="product-title-line">
                          <h3 className="product-title-text" data-testid="cart-line-name">
                            {line.name}
                          </h3>
                          <div className="product-line-subtotal">
                            <span className="line-total-amount" data-value={lineTotal}>
                              {formatTHB(lineTotal)}
                            </span>
                          </div>
                        </div>

                        <div className="product-meta-row">
                          <span
                            className="product-unit-price-label"
                            data-testid="cart-line-unit-price"
                            data-value={line.unitPrice}
                          >
                            {formatInteger(line.unitPrice)} บาท / ชิ้น
                          </span>

                          <span
                            className={`product-status-chip ${isOutOfStock ? "product-status-chip--unavailable" : "product-status-chip--available"}`}
                            data-testid="cart-line-availability"
                            data-available={line.available ? "true" : "false"}
                          >
                            {line.available ? "พร้อมจำหน่าย" : "สินค้าหมด"}
                          </span>
                        </div>

                        {/* ข้อความเตือนกรณีสินค้าหมด */}
                        {isOutOfStock && (
                          <p className="product-out-of-stock-alert" role="alert">
                            สินค้านี้หมดชั่วคราว กรุณานำออกก่อนดำเนินการชำระเงิน
                          </p>
                        )}

                        {/* แถบตัวปรับจำนวน + ปุ่มนำออก */}
                        <div className="product-bottom-action-bar">
                          {/* ตัวปรับจำนวน: ปุ่ม − [input จำนวน] + ในกรอบเดียวกัน แต่ละช่อง 44x44 */}
                          <div className="quantity-adjuster-box">
                            <button
                              type="button"
                              className="qty-btn-step"
                              aria-label="ลดจำนวน"
                              disabled={line.quantity <= 1 || isOutOfStock}
                              onClick={() => handleUpdateQty(line.productId, -1)}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="sr-only" data-testid="cart-line-qty" data-value={line.quantity}>
                              {line.quantity}
                            </span>
                            <input
                              type="number"
                              className="qty-direct-input"
                              data-testid="cart-line-qty-input"
                              aria-label={`จำนวน ${line.name}`}
                              min={1}
                              max={10}
                              value={line.quantity}
                              disabled={isOutOfStock}
                              onChange={(e) =>
                                handleDirectQtyChange(line.productId, parseInt(e.target.value, 10))
                              }
                            />
                            <button
                              type="button"
                              className="qty-btn-step"
                              aria-label="เพิ่มจำนวน"
                              disabled={line.quantity >= 10 || isOutOfStock}
                              onClick={() => handleUpdateQty(line.productId, 1)}
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          {/* ปุ่มนำออก */}
                          <button
                            type="button"
                            className={`remove-product-btn ${isOutOfStock ? "remove-product-btn--prominent" : ""}`}
                            data-testid="cart-line-remove"
                            disabled
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            <span>นำออก</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>

            {/* การ์ดการจัดส่ง */}
            <article className="cart-surface-card delivery-card" aria-labelledby="delivery-card-heading">
              <h2 id="delivery-card-heading" className="card-heading-title">
                การจัดส่ง
              </h2>
              <div className="delivery-fields-twin">
                <div className="delivery-select-group">
                  <label htmlFor="zone-select" className="delivery-field-label">
                    พื้นที่จัดส่ง
                  </label>
                  <select
                    id="zone-select"
                    data-testid="zone-select"
                    className="delivery-select-control"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  >
                    <option value="inCity">ในเมือง</option>
                    <option value="upcountry">ต่างจังหวัด</option>
                    <option value="remote">พื้นที่ห่างไกล</option>
                  </select>
                </div>

                <div className="delivery-select-group">
                  <label htmlFor="speed-select" className="delivery-field-label">
                    รูปแบบการจัดส่ง
                  </label>
                  <select
                    id="speed-select"
                    data-testid="speed-select"
                    className="delivery-select-control"
                    value={speed}
                    onChange={(e) => setSpeed(e.target.value)}
                  >
                    <option value="standard">ปกติ</option>
                    <option value="express">ด่วน</option>
                  </select>
                </div>
              </div>
            </article>
          </div>

          {/* คอลัมน์ขวา: การ์ดสรุปคำสั่งซื้อ */}
          <aside className="cart-right-column" aria-label="สรุปคำสั่งซื้อ">
            <article className="cart-surface-card order-summary-card">
              <h2 className="card-heading-title">สรุปคำสั่งซื้อ</h2>

              {/* ส่วนคูปอง */}
              <div className="coupon-card-section">
                <label htmlFor="coupon-input" className="coupon-input-label">
                  คูปองส่วนลด
                </label>
                <div className="coupon-input-action-row">
                  <input
                    id="coupon-input"
                    data-testid="coupon-input"
                    className="coupon-text-input"
                    type="text"
                    placeholder="กรอกรหัสคูปอง"
                    autoComplete="off"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="coupon-submit-btn"
                    data-testid="coupon-apply"
                    disabled
                  >
                    ใช้คูปอง
                  </button>
                </div>
                <div className="coupon-status-note" data-testid="cart-coupon-code">
                  {couponCode || "ยังไม่ได้ใช้คูปอง"}
                </div>
              </div>

              <div className="summary-card-divider" />

              {/* รายการยอด */}
              <dl className="summary-amounts-list">
                <div className="summary-amount-row">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd>
                    <span data-testid="cart-subtotal" data-value={subtotal}>
                      {formatTHB(subtotal)}
                    </span>
                  </dd>
                </div>
                <div className="summary-amount-row">
                  <dt>ส่วนลด</dt>
                  <dd>0 บาท</dd>
                </div>
                <div className="summary-amount-row">
                  <dt>ค่าจัดส่ง</dt>
                  <dd className="summary-muted-note">คำนวณเมื่อเชื่อมต่อ API</dd>
                </div>
              </dl>

              <div className="summary-card-divider" />

              {/* ยอดสุทธิ */}
              <div className="summary-net-total-row">
                <span className="net-total-label">ยอดสุทธิ</span>
                <span className="net-total-value">
                  {formatTHB(subtotal)}
                </span>
              </div>

              {/* ปุ่มดำเนินการชำระเงิน */}
              <button
                type="button"
                className="checkout-primary-submit-btn"
                data-testid="checkout-button"
                disabled
              >
                ดำเนินการชำระเงิน
              </button>
              <p className="checkout-helper-footnote">
                การดำเนินการจะเปิดใช้หลังเชื่อมต่อ API
              </p>
            </article>
          </aside>
        </div>
      </section>
    </AppShell>
  )
}
