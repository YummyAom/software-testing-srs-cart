import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppShell } from "@/components/commerce/shell"
import { PageScaffold } from "@/components/commerce/ui"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const role = username.toLowerCase().includes("admin") ? "admin" : "customer"
    sessionStorage.setItem("access_token", "mock-token")
    sessionStorage.setItem("user_role", role)
    sessionStorage.setItem("username", username || "customer1")

    if (role === "admin") {
      navigate("/admin/products")
    } else {
      navigate("/products")
    }
  }

  return (
    <AppShell>
      <PageScaffold
        pageTestId="page-login"
        title="เข้าสู่ระบบ"
        description="กรอกข้อมูลบัญชีเพื่อเข้าสู่ระบบสั่งซื้อ"
        className="login-page"
      >
        <section className="surface-panel login-panel" aria-labelledby="login-form-heading">
          <div className="panel-body">
            <h2 id="login-form-heading" className="login-panel-heading">
              ข้อมูลบัญชี
            </h2>
            <form onSubmit={handleLogin}>
              <fieldset className="form-stack login-fields">
                <legend className="sr-only">ข้อมูลสำหรับเข้าสู่ระบบ</legend>
                <div className="field-block">
                  <label htmlFor="login-username">ชื่อผู้ใช้</label>
                  <input
                    id="login-username"
                    data-testid="login-username"
                    className="form-control"
                    type="text"
                    autoComplete="username"
                    placeholder="ชื่อผู้ใช้ (พิมพ์ admin เพื่อเข้าสู่โหมดแอดมิน)"
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
                >
                  เข้าสู่ระบบ
                </button>
              </fieldset>
            </form>
            <p className="form-footnote">
              * โหมดทดสอบ (Mock Login): พิมพ์อะไรก็ได้เพื่อเข้าสู่ระบบ (หากพิมพ์มีคำว่า admin จะเข้าสู่หน้าแอดมิน)
            </p>
          </div>
        </section>
      </PageScaffold>
    </AppShell>
  )
}
