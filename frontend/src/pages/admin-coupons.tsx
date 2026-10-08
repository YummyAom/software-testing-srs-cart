import { AppShell } from "@/components/commerce/shell"
import { MoneyValue, PageScaffold, Panel, StatusPill } from "@/components/commerce/ui"
import { demoCoupons } from "@/lib/commerce-demo-data"

export default function AdminCouponsPage() {
  return (
    <AppShell role="admin" activePage="admin-coupons">
      <PageScaffold
        pageTestId="page-admin-coupons"
        title="จัดการคูปอง"
        description="ตรวจสอบรหัส ส่วนลดขั้นต่ำ และสถานะการใช้งาน"
      >
        <Panel
          title="คูปองทั้งหมด"
          description="หน้านี้แสดงข้อมูลตัวอย่าง การเปิดหรือปิดคูปองยังไม่เชื่อมต่อ API"
        >
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">รายการคูปองตัวอย่าง</caption>
              <thead>
                <tr>
                  <th scope="col">รหัสคูปอง</th>
                  <th scope="col">ส่วนลด</th>
                  <th scope="col">ยอดขั้นต่ำ</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {demoCoupons.map((coupon) => (
                  <tr key={coupon.code} data-testid={`admin-coupon-row-${coupon.code}`}>
                    <td data-label="รหัสคูปอง">
                      <strong>{coupon.code}</strong>
                    </td>
                    <td data-label="ส่วนลด">
                      <span data-testid="admin-coupon-percent" data-value={coupon.percent}>
                        {coupon.percent}%
                      </span>
                    </td>
                    <td data-label="ยอดขั้นต่ำ">
                      <MoneyValue amount={coupon.minSpend} testId="admin-coupon-min-spend" />
                    </td>
                    <td data-label="สถานะ">
                      <StatusPill
                        status={coupon.status}
                        label={coupon.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                        tone={coupon.status === "active" ? "positive" : "neutral"}
                        testId="admin-coupon-status"
                      />
                    </td>
                    <td data-label="จัดการ">
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        data-testid="admin-coupon-toggle-status"
                        disabled
                      >
                        {coupon.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
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
