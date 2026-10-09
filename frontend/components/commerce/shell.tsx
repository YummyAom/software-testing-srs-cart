import { Link, useNavigate } from "react-router-dom"
import { ShoppingBag } from "lucide-react"
import type { ReactNode } from "react"
import { useAuth } from "@/src/context/auth-context"
import { cartPreview } from "@/lib/commerce-demo-data"

type AppRole = "guest" | "customer" | "admin"
type ActivePage = "products" | "cart" | "checkout" | "success" | "orders" | "admin-products" | "admin-coupons"

type NavigationItem = {
  href: string
  label: string
  testId: string
  key: ActivePage
}

const customerNavigation: NavigationItem[] = [
  { href: "/products", label: "สินค้า", testId: "nav-products", key: "products" },
  { href: "/cart", label: "รถเข็น", testId: "nav-cart", key: "cart" },
  { href: "/orders", label: "คำสั่งซื้อ", testId: "nav-orders", key: "orders" },
]

const adminNavigation: NavigationItem[] = [
  {
    href: "/admin/products",
    label: "จัดการสินค้า",
    testId: "nav-admin-products",
    key: "admin-products",
  },
  {
    href: "/admin/coupons",
    label: "จัดการคูปอง",
    testId: "nav-admin-coupons",
    key: "admin-coupons",
  },
]

export function AppShell({
  children,
  role: propRole,
  activePage,
  hideHeader = false,
  hideFooter = false,
}: {
  children: ReactNode
  role?: AppRole
  activePage?: ActivePage
  hideHeader?: boolean
  hideFooter?: boolean
}) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const role = propRole || (user?.role as AppRole) || "guest"
  const customerFlowHref = activePage === "checkout" ? "/checkout" : activePage === "success" ? "/success" : "/cart"
  const cartItemCount = cartPreview.lines.length
  const navigation =
    role === "customer"
      ? customerNavigation.map((item) =>
          item.key === "cart" ? { ...item, href: customerFlowHref } : item,
        )
      : role === "admin"
        ? adminNavigation
        : []
  const brandHref = role === "admin" ? "/admin/products" : role === "customer" ? "/products" : "/login"

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="app-shell">
      {!hideHeader && (
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" to={brandHref} aria-label="ระบบสั่งซื้อ">
              <span className="brand-mark" aria-hidden="true">
                <ShoppingBag size={20} />
              </span>
              <span className="brand-name">ระบบสั่งซื้อ</span>
            </Link>
            {navigation.length > 0 ? (
              <nav className="primary-nav" aria-label={role === "admin" ? "เมนูผู้ดูแลระบบ" : "เมนูหลัก"}>
                {navigation.map((item) => (
                  <Link
                    key={item.key}
                    className="nav-link"
                    to={item.href}
                    data-testid={item.testId}
                    aria-current={
                      activePage === item.key ||
                      (item.key === "cart" && (activePage === "checkout" || activePage === "success"))
                        ? "page"
                        : undefined
                    }
                  >
                    <span>{item.label}</span>
                    {item.key === "cart" && cartItemCount > 0 && (
                      <span className="nav-badge" aria-label={`${cartItemCount} รายการ`}>
                        {cartItemCount}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            ) : null}
            <div className="header-actions">
              {role !== "guest" && (
                <button
                  type="button"
                  className="nav-logout-btn"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  aria-label="ออกจากระบบ"
                >
                  <span>ออกจากระบบ</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}
      <main className="app-main">{children}</main>
      {!hideFooter && (
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>ต้นแบบหน้าจอสำหรับตรวจสอบรูปแบบการใช้งาน</span>
            <span>ยังไม่ได้เชื่อมต่อ api-server</span>
          </div>
        </footer>
      )}
    </div>
  )
}
