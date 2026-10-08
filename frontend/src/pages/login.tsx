import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { PageScaffold } from "@/components/commerce/ui"
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

  const messageProps = error
    ? {
        message: error.message,
        messageKind: "error" as const,
        messageCode: error.code,
      }
    : {}

  return (
    <AppShell>
      <PageScaffold
        pageTestId="page-login"
        title="เข้าสู่ระบบ"
        description="กรอกข้อมูลบัญชีเพื่อเข้าสู่ระบบสั่งซื้อ"
        className="login-page"
        {...messageProps}
      >
        <section className="surface-panel login-panel" aria-labelledby="login-form-heading">
          <div className="panel-body">
            <h2 id="login-form-heading" className="login-panel-heading">
              ข้อมูลบัญชี
            </h2>
            <form onSubmit={handleLogin}>
              <fieldset className="form-stack login-fields" disabled={isLoading}>
                <legend className="sr-only">ข้อมูลสำหรับเข้าสู่ระบบ</legend>
                <div className="field-block">
                  <label htmlFor="login-username">อีเมล</label>
                  <input
                    id="login-username"
                    data-testid="login-username"
                    className="form-control"
                    type="text"
                    autoComplete="username"
                    placeholder="อีเมล"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="field-block">
                  <label htmlFor="login-password">รหัสผ่าน</label>
                  <input
                    id="login-password"
                    data-testid="login-password"
                    className="form-control"
                    type="password"
                    autoComplete="current-password"
                    placeholder="รหัสผ่าน"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="button button-primary button-full"
                  data-testid="login-submit"
                  disabled={isLoading}
                >
                  {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                </button>
              </fieldset>
            </form>
            <p className="form-footnote">
              * โหมดทดสอบ: customer1@example.com หรือ admin1@example.com รหัสผ่าน cart-test-only-password
            </p>
          </div>
        </section>
      </PageScaffold>
    </AppShell>
  )
}
