import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { DraftNumberInput } from "@/components/commerce/draft-number-input"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import { addCartItemApi, ApiError, getProductsApi, Product } from "@/src/lib/api-client"

type PageMessage = { kind: "error" | "notice" | "info"; text: string; code: string }

const errorCode = (err: unknown) => (err instanceof ApiError && err.code ? err.code : "")

export default function ProductsPage() {
  const { accessToken } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [message, setMessage] = useState<PageMessage | null>(null)

  useEffect(() => {
    // StrictMode runs this effect twice on the dev server. Only the latest load may fill the page:
    // a late response from an older load would reset the quantity after it has been typed.
    let stale = false
    async function load() {
      try {
        setLoading(true)
        const data = await getProductsApi(accessToken || undefined)
        if (stale) return
        setProducts(data)
        const initialQtys: Record<string, number> = {}
        for (const p of data) {
          initialQtys[p.productId] = 1
        }
        setQuantities(initialQtys)
      } catch (err: any) {
        if (stale) return
        setMessage({ kind: "error", text: err.message || "ไม่สามารถโหลดรายการสินค้าได้", code: errorCode(err) })
      } finally {
        if (!stale) setLoading(false)
      }
    }
    load()
    return () => {
      stale = true
    }
  }, [accessToken])

  const handleQtyChange = (productId: string, val: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: val }))
  }

  const handleAddToCart = async (product: Product) => {
    if (!accessToken) return
    // Send exactly what was entered (0, 11, 1.5 …) so api-server applies FR-2.1/FR-2.6.
    const qty = quantities[product.productId] ?? 1
    try {
      setAddingId(product.productId)
      setMessage(null)
      await addCartItemApi(accessToken, product.productId, qty)
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถเพิ่มสินค้าลงในตะกร้าได้", code: errorCode(err) })
    } finally {
      setAddingId(null)
    }
  }

  if (!accessToken) return <Navigate to="/login" replace />

  return (
    <AppShell role="customer" activePage="products">
      <PageScaffold
        pageTestId="page-products"
        title="สินค้า"
        description="เลือกดูสินค้า ราคา น้ำหนัก และจำนวนคงเหลือ"
      >
        {message && (
          <div
            className="demo-scaffold-banner"
            data-testid="app-message"
            data-kind={message.kind}
            data-code={message.code}
            role={message.kind === "error" ? "alert" : "status"}
            aria-live="polite"
            style={{
              backgroundColor: message.kind === "error" ? "#fee2e2" : "#f0fdf4",
              borderColor: message.kind === "error" ? "#f87171" : "#86efac",
              color: message.kind === "error" ? "#991b1b" : "#166534",
            }}
          >
            <p>{message.text}</p>
          </div>
        )}

        <Panel
          title="รายการสินค้า"
          description={loading ? "กำลังโหลดข้อมูลสินค้า..." : `พบสินค้าทั้งหมด ${products.length} รายการ`}
        >
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">รายการสินค้าที่พร้อมจำหน่าย</caption>
              <thead>
                <tr>
                  <th scope="col">สินค้า</th>
                  <th scope="col">ราคา</th>
                  <th scope="col">น้ำหนัก</th>
                  <th scope="col">คงเหลือ</th>
                  <th scope="col">จำนวน</th>
                  <th scope="col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.productId} data-testid={`product-row-${product.productId}`}>
                    <td data-label="สินค้า">
                      <strong data-testid="product-name">{product.name}</strong>
                    </td>
                    <td data-label="ราคา">
                      <MoneyValue amount={product.price} testId="product-price" />
                    </td>
                    <td data-label="น้ำหนัก">
                      <span data-value={product.weightGram}>{product.weightGram} กรัม</span>
                    </td>
                    <td data-label="คงเหลือ">
                      <QuantityValue value={product.availableStock} suffix="ชิ้น" testId="product-stock" />
                    </td>
                    <td data-label="จำนวน">
                      <label className="sr-only" htmlFor={`product-qty-${product.productId}`}>
                        จำนวนสำหรับ {product.name}
                      </label>
                      <DraftNumberInput
                        id={`product-qty-${product.productId}`}
                        data-testid="product-add-qty"
                        className="form-control form-control--compact"
                        initialValue={quantities[product.productId] ?? 1}
                        min={1}
                        max={Math.min(10, product.availableStock)}
                        step={1}
                        inputMode="numeric"
                        onValueChange={(val: number) => handleQtyChange(product.productId, val)}
                      />
                    </td>
                    <td data-label="จัดการ">
                      <button
                        type="button"
                        className="button button-primary button-small"
                        data-testid="product-add-button"
                        disabled={addingId === product.productId || product.availableStock <= 0}
                        onClick={() => handleAddToCart(product)}
                      >
                        {addingId === product.productId ? "กำลังเพิ่ม..." : "เพิ่มสินค้า"}
                      </button>
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
