import { DraftNumberInput } from "@/components/commerce/draft-number-input"
import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, QuantityValue } from "@/components/commerce/ui"
import { catalogProducts } from "@/lib/commerce-demo-data"

export default function ProductsPage() {
  return (
    <AppShell role="customer" activePage="products">
      <PageScaffold
        pageTestId="page-products"
        title="สินค้า"
        description="เลือกดูสินค้า ราคา น้ำหนัก และจำนวนคงเหลือ"
      >
        <Panel
          title="รายการสินค้า"
          description="จำนวนในช่องด้านล่างเป็นเพียง input draft ปุ่มเพิ่มสินค้าจะทำงานหลังเชื่อมต่อ API"
        >
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">รายการสินค้าตัวอย่างที่พร้อมจำหน่าย</caption>
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
                {catalogProducts.map((product) => (
                  <tr key={product.id} data-testid={`product-row-${product.id}`}>
                    <td data-label="สินค้า">
                      <strong data-testid="product-name">{product.name}</strong>
                    </td>
                    <td data-label="ราคา">
                      <MoneyValue amount={product.price} testId="product-price" />
                    </td>
                    <td data-label="น้ำหนัก">
                      <span data-value={product.weightGrams}>{product.weightGrams} กรัม</span>
                    </td>
                    <td data-label="คงเหลือ">
                      <QuantityValue value={product.stock} suffix="ชิ้น" testId="product-stock" />
                    </td>
                    <td data-label="จำนวน">
                      <label className="sr-only" htmlFor={`product-qty-${product.id}`}>
                        จำนวนสำหรับ {product.name}
                      </label>
                      <DraftNumberInput
                        id={`product-qty-${product.id}`}
                        data-testid="product-add-qty"
                        className="form-control form-control--compact"
                        initialValue={1}
                        min={1}
                        max={10}
                        step={1}
                        inputMode="numeric"
                      />
                    </td>
                    <td data-label="จัดการ">
                      <button
                        type="button"
                        className="button button-primary button-small"
                        data-testid="product-add-button"
                        disabled
                      >
                        เพิ่มสินค้า
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
