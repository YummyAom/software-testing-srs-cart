import { describe, it, expect, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }

beforeEach(async () => {
    // only the APP_ENV=test server has /test/reset, so a 404 here means the API is on the shared DB: stop before writing anything
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)
})

describe("OP-1 login - Simplified Decision Table", () => {
    it("OP1-A1 (Rule 1: T, T) login succeeds with valid credentials (FR-0.1.1)", async () => {
        // Precondition -> seeded account cus_normal exists
        const res = await fetch(`${baseURL}/auth/login`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({
                username: "cus_normal",
                password: "Normal@123456",
            }),
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(typeof body.data.accessToken).toBe("string")
        expect(body.data.user.username).toBe("cus_normal")
        expect(body.data.user.role).toBe("customer")
    })

    it("OP1-B1 (Rule 2: T, F) login rejects when username exists but password is wrong (FR-0.1.2)", async () => {
        // Precondition -> seeded account cus_normal exists, password does not match
        const res = await fetch(`${baseURL}/auth/login`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({
                username: "cus_normal",
                password: "wrong_password_999",
            }),
        })

        expect(res.status).toBe(401)

        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_INVALID_CREDENTIALS")
    })

    it("OP1-B2 (Rule 3: F, -) login rejects when username does not exist regardless of password (FR-0.1.2)", async () => {
        // Precondition -> username ghost_user_999 is not registered
        const res = await fetch(`${baseURL}/auth/login`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({
                username: "ghost_user_999",
                password: "wrong_password_999",
            }),
        })

        expect(res.status).toBe(401)

        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_INVALID_CREDENTIALS")
    })
})
//run
//npx vitest run
//npx vitest --ui
//npm.cmd run test:api -- tests/api/login.test.ts
//npx.cmd vitest --config vitest.api.config.ts --ui tests/api/login.test.ts

  