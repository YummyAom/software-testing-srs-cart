import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { useAuth } from "@/src/context/auth-context"
import {
  applyCartCouponApi,
  Cart,
  checkoutCartApi,
  getCartApi,
  removeCartItemApi,
  updateCartItemQtyApi,
} from "@/src/lib/api-client"
import { Minus, Package, Plus, Trash2 } from "lucide-react"

function formatTHB(amount: number) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(amount)} บาท`
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value)
}

export default function CartPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [couponInput, setCouponInput] = useState("")
  const [zone, setZone] = useState("inCity")
  const [speed, setSpeed] = useState("standard")
  const [actionPending, setActionPending] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "notice" | "info"; text: string; code?: string } | null>(null)

  const loadCart = async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await getCartApi(accessToken)
      setCart(data)
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถโหลดข้อมูลตะกร้าได้", code: err.code })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCart()
  }, [accessToken])

  const handleUpdateQty = async (productId: string, nextQty: number) => {
    if (!accessToken || nextQty < 1 || nextQty > 10) return
    try {
      setActionPending(true)
      setMessage(null)
      const updated = await updateCartItemQtyApi(accessToken, productId, nextQty)
      setCart(updated)
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถปรับปรุงจำนวนสินค้าได้", code: err.code })
    } finally {
      setActionPending(false)
    }
  }

  const handleRemove = async (productId: string) => {
    if (!accessToken) return
    try {
      setActionPending(true)
      setMessage(null)
      const updated = await removeCartItemApi(accessToken, productId)
      setCart(updated)
      if (updated.lines.length === 0) {
        setMessage({ kind: "info", text: "ตะกร้าว่าง" })
      }
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถนำสินค้าออกจากตะกร้าได้", code: err.code })
    } finally {
      setActionPending(false)
    }
  }

  const handleApplyCoupon = async () => {
    if (!accessToken || !couponInput.trim()) return
    try {
      setActionPending(true)
      setMessage(null)
      const updated = await applyCartCouponApi(accessToken, couponInput.trim())
      setCart(updated)
      setCouponInput("")
      setMessage({ kind: "info", text: `ใช้คูปอง ${updated.couponCode} สำเร็จ` })
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "คูปองไม่ถูกต้อง", code: err.code })
    } finally {
      setActionPending(false)
    }
  }

  const handleCheckout = async () => {
    if (!accessToken) return
    try {
      setActionPending(true)
      setMessage(null)
      const res = await checkoutCartApi(accessToken, zone, speed)
      navigate("/checkout", { state: { orderId: res.order.orderId } })
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถดำเนินการชำระเงินได้", code: err.code })
    } finally {
      setActionPending(false)
    }
  }

  const lines = cart?.lines || []
  const subtotal = cart?.subtotal || 0
  const couponCode = cart?.couponCode || ""
  const checkoutEnabled = (cart?.checkoutEnabled ?? false) && lines.length > 0

  return (
    <AppShell role="customer" activePage="cart">
      <section className="cart-page-frame" data-testid="page-cart" aria-labelledby="page-cart-heading">
        {message && (
          <div
            className="demo-scaffold-banner"
            data-testid="app-message"
            data-kind={message.kind}
            data-code={message.code || ""}
            role={message.kind === "error" ? "alert" : "status"}
            aria-live="polite"
            style={{
              backgroundColor: message.kind === "error" ? "#fee2e2" : "#fef3c7",
              borderColor: message.kind === "error" ? "#f87171" : "#fcd34d",
              color: message.kind === "error" ? "#991b1b" : "#92400e",
            }}
          >
            <p>{message.text}</p>
          </div>
        )}

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

        <div className="cart-two-column-layout">
          <div className="cart-left-column">
            <article className="cart-surface-card" aria-labelledby="items-card-heading">
              <div className="card-top-header">
                <h2 id="items-card-heading" className="card-heading-title">
                  รายการสินค้า
                </h2>
                <span className="card-heading-meta" data-value={lines.length}>
                  {loading ? "กำลังโหลด..." : `${formatInteger(lines.length)} รายการ`}
                </span>
              </div>

              {lines.length === 0 && !loading && (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  ยังไม่มีสินค้าในรถเข็น
                </div>
              )}

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
                      <div className="product-media-thumbnail" aria-hidden="true">
                        <Package size={36} strokeWidth={1.6} />
                      </div>

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

                        {isOutOfStock && (
                          <p className="product-out-of-stock-alert" role="alert">
                            สินค้านี้หมดชั่วคราว กรุณานำออกก่อนดำเนินการชำระเงิน
                          </p>
                        )}

                        <div className="product-bottom-action-bar">
                          <div className="quantity-adjuster-box">
                            <button
                              type="button"
                              className="qty-btn-step"
                              aria-label="ลดจำนวน"
                              disabled={line.quantity <= 1 || isOutOfStock || actionPending}
                              onClick={() => handleUpdateQty(line.productId, line.quantity - 1)}
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
                              disabled={isOutOfStock || actionPending}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                if (!isNaN(val) && val >= 1 && val <= 10) {
                                  handleUpdateQty(line.productId, val)
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="qty-btn-step"
                              aria-label="เพิ่มจำนวน"
                              disabled={line.quantity >= 10 || isOutOfStock || actionPending}
                              onClick={() => handleUpdateQty(line.productId, line.quantity + 1)}
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="button button-secondary button-small"
                            data-testid="cart-line-update"
                            style={{ display: "none" }}
                            onClick={() => handleUpdateQty(line.productId, line.quantity)}
                          >
                            อัปเดต
                          </button>

                          <button
                            type="button"
                            className={`remove-product-btn ${isOutOfStock ? "remove-product-btn--prominent" : ""}`}
                            data-testid="cart-line-remove"
                            disabled={actionPending}
                            onClick={() => handleRemove(line.productId)}
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

          <aside className="cart-right-column" aria-label="สรุปคำสั่งซื้อ">
            <article className="cart-surface-card order-summary-card">
              <h2 className="card-heading-title">สรุปคำสั่งซื้อ</h2>

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
                    disabled={actionPending}
                    onChange={(e) => setCouponInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="coupon-submit-btn"
                    data-testid="coupon-apply"
                    disabled={actionPending || !couponInput.trim()}
                    onClick={handleApplyCoupon}
                  >
                    ใช้คูปอง
                  </button>
                </div>
                <div className="coupon-status-note" data-testid="cart-coupon-code">
                  {couponCode || "ยังไม่ได้ใช้คูปอง"}
                </div>
              </div>

              <div className="summary-card-divider" />

              <dl className="summary-amounts-list">
                <div className="summary-amount-row">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd>
                    <span data-testid="cart-subtotal" data-value={subtotal}>
                      {formatTHB(subtotal)}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="summary-card-divider" />

              <div className="summary-net-total-row">
                <span className="net-total-label">ยอดสุทธิ (ก่อนค่าจัดส่ง)</span>
                <span className="net-total-value">
                  {formatTHB(subtotal)}
                </span>
              </div>

              <button
                type="button"
                className="checkout-primary-submit-btn"
                data-testid="checkout-button"
                disabled={actionPending || !checkoutEnabled}
                onClick={handleCheckout}
              >
                {actionPending ? "กำลังดำเนินการ..." : "ดำเนินการชำระเงิน"}
              </button>
            </article>
          </aside>
        </div>
      </section>
    </AppShell>
  )
}
