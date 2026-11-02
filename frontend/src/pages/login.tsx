import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingBag } from "lucide-react"
import { AppShell } from "@/components/commerce/shell"
import { useAuth } from "@/src/context/auth-context"
import { ApiError } from "@/src/lib/api-client"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await login(username, password)

      const role = sessionStorage.getItem("user_role") || "customer"
      if (role === "admin") {
        navigate("/admin/products")
      } else {
        navigate("/products")
      }
    } catch (err: any) {
      let code = "UNKNOWN_ERROR"
      let defaultMessage = err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"

      if (err instanceof ApiError) {
        code = err.code
        switch (code) {
          case 'AUTH_INVALID_CREDENTIALS': 
            defaultMessage = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"; 
            break;
          case 'VALIDATION_ERROR': 
            defaultMessage = "รูปแบบชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"; 
            break;
          case 'AUTH_EMAIL_NOT_CONFIRMED': 
            defaultMessage = "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"; 
            break;
          case 'AUTH_PROFILE_NOT_FOUND': 
            defaultMessage = "ไม่พบข้อมูลโปรไฟล์ผู้ใช้ในระบบ"; 
            break;
          case 'AUTH_RATE_LIMITED': 
            defaultMessage = "คุณพยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่"; 
            break;
          case 'AUTH_UNAVAILABLE': 
            defaultMessage = "ระบบยืนยันตัวตนไม่พร้อมใช้งานชั่วคราว"; 
            break;
        }
      }

      setError({ code, message: defaultMessage })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppShell role="guest" hideHeader hideFooter>
      <div
        className="login-screen-wrapper"
        data-testid="page-login"
        style={{
          gap: "28px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* กล่อง Login หลัก */}
        <div className="login-card-container">
          <div className="login-brand-icon-box" aria-hidden="true">
            <ShoppingBag size={28} strokeWidth={2} />
          </div>

          <h1 className="login-card-title">Login</h1>
          <p className="login-card-subtitle">ยินดีต้อนรับกลับมา</p>

          {error && (
            <div
              className="login-error-alert"
              data-testid="app-message"
              data-kind="error"
              data-code={error.code}
              role="alert"
              aria-live="assertive"
            >
              <span className="login-error-mark" aria-hidden="true">
                !
              </span>
              <p>{error.message}</p>
            </div>
          )}

          <form className="login-card-form" onSubmit={handleLogin}>
            <div className="login-input-group">
              <label htmlFor="login-username" className="login-field-label">
                ชื่อผู้ใช้ (Username)
              </label>
              <input
                id="login-username"
                data-testid="login-username"
                className="login-text-input"
                type="text"
                autoComplete="username"
                placeholder="ชื่อผู้ใช้ (เช่น admin, cus_normal)"
                value={username}
                disabled={isLoading}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="login-input-group">
              <label htmlFor="login-password" className="login-field-label">
                รหัสผ่าน
              </label>
              <input
                id="login-password"
                data-testid="login-password"
                className="login-text-input"
                type="password"
                autoComplete="current-password"
                placeholder="รหัสผ่าน"
                value={password}
                disabled={isLoading}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              data-testid="login-submit"
              disabled={isLoading}
            >
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>

        {/* กล่องข้อมูลบัญชีสำหรับทดสอบ แยกออกมาต่างหาก (Standalone Test Accounts Card) */}
        <aside
          style={{
            width: "100%",
            maxWidth: "360px",
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "24px 20px",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.45)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxSizing: "border-box",
          }}
          aria-label="บัญชีสำหรับทดสอบ"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderBottom: "1px solid var(--app-border)",
              paddingBottom: "12px",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>🔑</span>
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "var(--app-text, #ffffff)",
                }}
              >
                บัญชีสำหรับทดสอบ (Seed Accounts)
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--app-text-muted, #94a3b8)",
                }}
              >
                คลิกเพื่อกรอก Username & Password อัตโนมัติ
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setUsername("cus_normal")
                setPassword("Normal@123456")
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--app-surface-hover, #1D2330)",
                border: "1px solid var(--app-border, #364154)",
                cursor: "pointer",
                textAlign: "left",
                color: "#e2e8f0",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "#38bdf8",
                  }}
                >
                  👤 Normal Customer
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "#334155",
                    color: "#94a3b8",
                  }}
                >
                  tier: normal
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                Username: <code style={{ color: "#f8fafc" }}>cus_normal</code>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Password: <code style={{ color: "#f8fafc" }}>Normal@123456</code>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername("cus_prime")
                setPassword("Prime@123456")
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--app-surface-hover, #1D2330)",
                border: "1px solid var(--app-border, #364154)",
                cursor: "pointer",
                textAlign: "left",
                color: "#e2e8f0",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "#a855f7",
                  }}
                >
                  ⭐ Prime Customer
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "#3b0764",
                    color: "#d8b4fe",
                  }}
                >
                  tier: prime
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                Username: <code style={{ color: "#f8fafc" }}>cus_prime</code>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Password: <code style={{ color: "#f8fafc" }}>Prime@123456</code>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername("admin01")
                setPassword("Admin@123456")
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--app-surface-hover, #1D2330)",
                border: "1px solid var(--app-border, #364154)",
                cursor: "pointer",
                textAlign: "left",
                color: "#e2e8f0",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "#f59e0b",
                  }}
                >
                  🛡️ Admin
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "#78350f",
                    color: "#fde68a",
                  }}
                >
                  role: admin
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                Username: <code style={{ color: "#f8fafc" }}>admin01</code> (หรือ admin)
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Password: <code style={{ color: "#f8fafc" }}>Admin@123456</code>
              </div>
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
