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
            defaultMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"; 
            break;
          case 'VALIDATION_ERROR': 
            defaultMessage = "รูปแบบอีเมลหรือรหัสผ่านไม่ถูกต้อง"; 
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
      <div className="login-screen-wrapper" data-testid="page-login">
        <div className="login-card-container">
          {/* ไอคอนบนสุด ขยายใหญ่ขึ้นในกรอบสีเดิม */}
          <div className="login-brand-icon-box" aria-hidden="true">
            <ShoppingBag size={28} strokeWidth={2} />
          </div>

          {/* คำว่า Login ตัวหนา ขนาดใหญ่พอดี */}
          <h1 className="login-card-title">Login</h1>
          <p className="login-card-subtitle">ยินดีต้อนรับกลับมา</p>

          {/* กล่องข้อความแจ้งเตือนข้อผิดพลาด (ถ้ามี) */}
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

          {/* ฟอร์มเข้าสู่ระบบ */}
          <form className="login-card-form" onSubmit={handleLogin}>
            <div className="login-input-group">
              <label htmlFor="login-username" className="login-field-label">
                อีเมล
              </label>
              <input
                id="login-username"
                data-testid="login-username"
                className="login-text-input"
                type="text"
                autoComplete="username"
                placeholder="อีเมล"
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
      </div>
    </AppShell>
  )
}
