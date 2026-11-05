import { useEffect, useState } from "react"
import { DraftNumberInput } from "@/components/commerce/draft-number-input"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, QuantityValue, StatusPill } from "@/components/commerce/ui"
import { useAuth } from "@/src/context/auth-context"
import {
  ApiError,
  getProductsApi,
  Product,
  toggleAdminProductStatusApi,
  updateAdminProductApi,
} from "@/src/lib/api-client"

type PageMessage = { kind: "error" | "notice" | "info"; text: string; code: string }

const errorCode = (err: unknown) => (err instanceof ApiError && err.code ? err.code : "")

export default function AdminProductsPage() {
  const { accessToken } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [draftPrices, setDraftPrices] = useState<Record<string, number>>({})
  const [draftStocks, setDraftStocks] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<PageMessage | null>(null)

  useEffect(() => {
    if (!accessToken) return
    const token = accessToken
    // StrictMode runs this effect twice on the dev server. Only the latest load may fill the page:
    // a late response from an older load would reset the price and stock after they have been typed.
    let stale = false
    async function load() {
      try {
        setLoading(true)
        const data = await getProductsApi(token)
        if (stale) return
        setProducts(data)
        const prices: Record<string, number> = {}
        const stocks: Record<string, number> = {}
        for (const p of data) {
          prices[p.productId] = p.price
          stocks[p.productId] = p.availableStock
        }
        setDraftPrices(prices)
        setDraftStocks(stocks)
      } catch (err: any) {
        if (stale) return
        setMessage({ kind: "error", text: err.message || "ไม่สามารถโหลดข้อมูลสินค้าได้", code: errorCode(err) })
      } finally {
        if (!stale) setLoading(false)
      }
    }
    load()
    return () => {
      stale = true
    }
  }, [accessToken])

  const handleSave = async (product: Product) => {
    if (!accessToken) return
    const price = draftPrices[product.productId]
    const stock = draftStocks[product.productId]
    try {
      setSavingId(product.productId)
      setMessage(null)
      const updated = await updateAdminProductApi(accessToken, product.productId, { price, stock })
      setProducts((prev) => prev.map((p) => (p.productId === updated.productId ? updated : p)))
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถบันทึกข้อมูลสินค้าได้", code: errorCode(err) })
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleStatus = async (product: Product) => {
    if (!accessToken) return
    const nextStatus = product.status === "onSale" ? "offSale" : "onSale"
    try {
      setSavingId(product.productId)
      setMessage(null)
      const updated = await toggleAdminProductStatusApi(accessToken, product.productId, nextStatus)
      setProducts((prev) => prev.map((p) => (p.productId === updated.productId ? updated : p)))
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "ไม่สามารถเปลี่ยนสถานะสินค้าได้", code: errorCode(err) })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <AppShell role="admin" activePage="admin-products">
      <PageScaffold
        pageTestId="page-admin-products"
        title="จัดการสินค้า"
        description="ดูสินค้า สถานะ ราคา และสต็อก รวมถึงรายการที่หมดหรือปิดจำหน่าย"
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
              padding: "1rem",
              marginBottom: "1.5rem",
              borderRadius: "6px",
              backgroundColor: message.kind === "error" ? "#fee2e2" : "#f0fdf4",
              borderColor: message.kind === "error" ? "#f87171" : "#86efac",
              color: message.kind === "error" ? "#991b1b" : "#166534",
            }}
          >
            <p>{message.text}</p>
          </div>
        )}

        <Panel
          title="สินค้าทั้งหมด"
          description={loading ? "กำลังโหลดข้อมูลสินค้า..." : `สินค้าทั้งหมด ${products.length} รายการ`}
        >
          <div className="table-scroll">
            <table className="data-table admin-products-table">
              <caption className="sr-only">รายการสินค้าสำหรับผู้ดูแลระบบ</caption>
              <thead>
                <tr>
                  <th scope="col">สินค้า</th>
                  <th scope="col">ราคา</th>
                  <th scope="col">สต็อก</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">แก้ไขราคา</th>
                  <th scope="col">แก้ไขสต็อก</th>
                  <th scope="col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.productId} data-testid={`admin-product-row-${product.productId}`}>
                    <td data-label="สินค้า">
                      <strong data-testid="admin-product-name">{product.name}</strong>
                    </td>
                    <td data-label="ราคา">
                      <MoneyValue amount={product.price} testId="admin-product-price" />
                    </td>
                    <td data-label="สต็อก">
                      <QuantityValue value={product.availableStock} suffix="ชิ้น" testId="admin-product-stock" />
                    </td>
                    <td data-label="สถานะ">
                      <StatusPill
                        status={product.status || "onSale"}
                        label={product.status === "onSale" ? "วางจำหน่าย" : "ปิดจำหน่าย"}
                        tone={product.status === "onSale" ? "positive" : "neutral"}
                        testId="admin-product-status"
                      />
                    </td>
                    <td data-label="แก้ไขราคา">
                      <label className="sr-only" htmlFor={`admin-price-${product.productId}`}>
                        ราคาใหม่สำหรับ {product.name}
                      </label>
                      <DraftNumberInput
                        id={`admin-price-${product.productId}`}
                        data-testid="admin-product-price-input"
                        className="form-control form-control--compact"
                        initialValue={draftPrices[product.productId] ?? product.price}
                        min={0}
                        step={1}
                        inputMode="numeric"
                        onValueChange={(val: number) =>
                          setDraftPrices((prev) => ({ ...prev, [product.productId]: val }))
                        }
                      />
                    </td>
                    <td data-label="แก้ไขสต็อก">
                      <label className="sr-only" htmlFor={`admin-stock-${product.productId}`}>
                        จำนวนสต็อกใหม่สำหรับ {product.name}
                      </label>
                      <DraftNumberInput
                        id={`admin-stock-${product.productId}`}
                        data-testid="admin-product-stock-input"
                        className="form-control form-control--compact"
                        initialValue={draftStocks[product.productId] ?? product.availableStock}
                        min={0}
                        step={1}
                        inputMode="numeric"
                        onValueChange={(val: number) =>
                          setDraftStocks((prev) => ({ ...prev, [product.productId]: val }))
                        }
                      />
                    </td>
                    <td data-label="จัดการ">
                      <div className="button-row admin-actions">
                        <button
                          type="button"
                          className="button button-primary button-small"
                          data-testid="admin-product-save"
                          disabled={savingId === product.productId}
                          onClick={() => handleSave(product)}
                        >
                          {savingId === product.productId ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          data-testid="admin-product-toggle-status"
                          disabled={savingId === product.productId}
                          onClick={() => handleToggleStatus(product)}
                        >
                          {product.status === "onSale" ? "ปิดขาย" : "เปิดขาย"}
                        </button>
                      </div>
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
