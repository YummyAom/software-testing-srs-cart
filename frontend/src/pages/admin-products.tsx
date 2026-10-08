import { DraftNumberInput } from "@/components/commerce/draft-number-input"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, QuantityValue, StatusPill } from "@/components/commerce/ui"
import { demoProducts } from "@/lib/commerce-demo-data"

export default function AdminProductsPage() {
  return (
    <AppShell role="admin" activePage="admin-products">
      <PageScaffold
        pageTestId="page-admin-products"
        title="จัดการสินค้า"
        description="ดูสินค้า สถานะ ราคา และสต็อก รวมถึงรายการที่หมดหรือปิดจำหน่าย"
      >
        <Panel
          title="สินค้าทั้งหมด"
          description="แก้ไขราคาและสต็อกได้ในช่อง draft แต่การบันทึกและเปลี่ยนสถานะยังปิดไว้"
        >
          <div className="table-scroll">
            <table className="data-table admin-products-table">
              <caption className="sr-only">รายการสินค้าตัวอย่างสำหรับผู้ดูแลระบบ</caption>
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
                {demoProducts.map((product) => (
                  <tr key={product.id} data-testid={`admin-product-row-${product.id}`}>
                    <td data-label="สินค้า">
                      <strong data-testid="admin-product-name">{product.name}</strong>
                    </td>
                    <td data-label="ราคา">
                      <MoneyValue amount={product.price} testId="admin-product-price" />
                    </td>
                    <td data-label="สต็อก">
                      <QuantityValue value={product.stock} suffix="ชิ้น" testId="admin-product-stock" />
                    </td>
                    <td data-label="สถานะ">
                      <StatusPill
                        status={product.status}
                        label={product.status === "onSale" ? "วางจำหน่าย" : "ปิดจำหน่าย"}
                        tone={product.status === "onSale" ? "positive" : "neutral"}
                        testId="admin-product-status"
                      />
                    </td>
                    <td data-label="แก้ไขราคา">
                      <label className="sr-only" htmlFor={`admin-price-${product.id}`}>
                        ราคาใหม่สำหรับ {product.name}
                      </label>
                      <DraftNumberInput
                        id={`admin-price-${product.id}`}
                        data-testid="admin-product-price-input"
                        className="form-control form-control--compact"
                        initialValue={product.price}
                        min={0}
                        step={1}
                        inputMode="numeric"
                      />
                    </td>
                    <td data-label="แก้ไขสต็อก">
                      <label className="sr-only" htmlFor={`admin-stock-${product.id}`}>
                        จำนวนสต็อกใหม่สำหรับ {product.name}
                      </label>
                      <DraftNumberInput
                        id={`admin-stock-${product.id}`}
                        data-testid="admin-product-stock-input"
                        className="form-control form-control--compact"
                        initialValue={product.stock}
                        min={0}
                        step={1}
                        inputMode="numeric"
                      />
                    </td>
                    <td data-label="จัดการ">
                      <div className="button-row admin-actions">
                        <button
                          type="button"
                          className="button button-primary button-small"
                          data-testid="admin-product-save"
                          disabled
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          data-testid="admin-product-toggle-status"
                          disabled
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
