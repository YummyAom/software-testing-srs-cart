import { describe, it, expect, beforeAll, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }

let NORMAL: Record<string, string>
let ADMIN: Record<string, string>

async function loginAs(username: string, password: string | undefined) {
    const res = await fetch(`${baseURL}/auth/login`, {
        method: "POST",
        headers: JSON_HDR,
        body: JSON.stringify({ username, password }),
    })
    const body: any = await res.json()
    if (!res.ok || !body?.data?.accessToken) {
        throw new Error(`login as ${username} failed: ${res.status} ${JSON.stringify(body)}`)
    }
    return { Authorization: `Bearer ${body.data.accessToken}` }
}

// login once per file: logging in for every test hits the Supabase Auth rate limit.
// /test/reset keeps app_users, so these tokens stay valid across resets.
beforeAll(async () => {
    NORMAL = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

beforeEach(async () => {
    // only the APP_ENV=test server has /test/reset, so a 404 here means the API is on the shared DB: stop before writing anything
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)
})

// =============================================================================
// OP-16: setProductStatus(productId, status) - POST /admin/products/:productId/status
// =============================================================================

describe("OP-16 setProductStatus - Happy Path", () => {
    it("OP16-A1 (FR-9.3.2) set product to offSale", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P1")
        expect(body.data.status).toBe("offSale")

        // Assert customer cannot see offSale product
        const cusRes = await fetch(`${baseURL}/products`, { headers: NORMAL })
        const cusBody: any = await cusRes.json()
        expect(cusBody.data.products.find((p: any) => p.productId === "P1")).toBeUndefined()
    })

    it("OP16-A2 (FR-9.3.2) set product from offSale back to onSale", async () => {
        // Set offSale first
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        // Set back to onSale
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "onSale" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P1")
        expect(body.data.status).toBe("onSale")

        // Assert customer can see onSale product again
        const cusRes = await fetch(`${baseURL}/products`, { headers: NORMAL })
        const cusBody: any = await cusRes.json()
        expect(cusBody.data.products.find((p: any) => p.productId === "P1")).toBeDefined()
    })

    it("OP16-A3 (FR-9.3.3) setting same status onSale -> onSale is idempotent without error", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "onSale" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P1")
        expect(body.data.status).toBe("onSale")
    })

    it("OP16-A4 (FR-9.3.3) setting same status offSale -> offSale is idempotent without error", async () => {
        // First set offSale
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        // Re-set offSale
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P1")
        expect(body.data.status).toBe("offSale")
    })

    it("OP16-A5 (FR-9.3.4) offSale product stays in customer cart with available=false", async () => {
        // Customer adds P1 to cart
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        // Admin turns P1 offSale
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        // Customer views cart
        const cartRes = await fetch(`${baseURL}/cart`, { headers: NORMAL })
        expect(cartRes.status).toBe(200)
        const cartBody: any = await cartRes.json()
        const p1 = cartBody.data.lines.find((l: any) => l.productId === "P1")
        expect(p1).toBeDefined()
        expect(p1.available).toBe(false)
    })

    it("OP16-A6 (FR-9.3.5) status change does not affect existing orders", async () => {
        // Customer checkouts P1 x 1
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        // Admin turns P1 offSale
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        // View existing order -> intact
        const orderRes = await fetch(`${baseURL}/orders/${orderId}`, { headers: NORMAL })
        expect(orderRes.status).toBe(200)
        const orderBody: any = await orderRes.json()
        expect(orderBody.data.lines.find((l: any) => l.productId === "P1")).toBeDefined()
    })
})

describe("OP-16 setProductStatus - Negative", () => {
    it("OP16-B1 (FR-9.3.1) nonexistent product returns 404 PRODUCT_NOT_FOUND", async () => {
        const res = await fetch(`${baseURL}/admin/products/P9/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_NOT_FOUND")
    })

    it("OP16-B2 (FR-9.3.1) lowercase productId 'p1' returns 404 PRODUCT_NOT_FOUND", async () => {
        const res = await fetch(`${baseURL}/admin/products/p1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_NOT_FOUND")
    })

    it("OP16-B3 (FR-9.3.1) invalid status string returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "closed" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
        expect(body.error.details.fields).toContain("status")
    })

    it("OP16-B4 (FR-0.2) missing authorization header returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ status: "offSale" }),
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP16-B5 (FR-0.3.2) Customer token calling setProductStatus returns 403 AUTH_FORBIDDEN", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})

