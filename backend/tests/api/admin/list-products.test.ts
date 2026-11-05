import { describe, it, expect, beforeEach } from "vitest"

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
    return { Authorization: `Bearer ${body.data.accessToken}` }
}

beforeEach(async () => {
    // only the APP_ENV=test server has /test/reset, so a 404 here means the API is on the shared DB: stop before writing anything
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)

    NORMAL = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

// =============================================================================
// OP-2: listProducts() - Admin view (GET /products)
// =============================================================================

describe("OP-2 listProducts (Admin) - Happy Path", () => {
    it("OP2-A1 (FR-1.3.2) Admin sees all seed products with status field", async () => {
        const res = await fetch(`${baseURL}/products`, {
            headers: ADMIN,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(Array.isArray(body.data.products)).toBe(true)
        expect(body.data.products.length).toBeGreaterThanOrEqual(3)

        // Seed products: P1, P2, P3
        const p1 = body.data.products.find((p: any) => p.productId === "P1")
        expect(p1).toBeDefined()
        expect(p1.name).toBe("Coffee Beans 250g")
        expect(p1.price).toBe(450)
        expect(p1.weightGram).toBe(300)
        expect(p1.availableStock).toBe(20)
        expect(p1.status).toBe("onSale")

        const p2 = body.data.products.find((p: any) => p.productId === "P2")
        expect(p2).toBeDefined()
        expect(p2.status).toBe("onSale")

        const p3 = body.data.products.find((p: any) => p.productId === "P3")
        expect(p3).toBeDefined()
        expect(p3.status).toBe("onSale")
    })

    it("OP2-A2 (FR-1.3.2) Admin sees offSale products (Customer cannot)", async () => {
        // Admin turns P1 offSale
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        // Admin lists products -> P1 still visible with status offSale
        const adminRes = await fetch(`${baseURL}/products`, { headers: ADMIN })
        expect(adminRes.status).toBe(200)
        const adminBody: any = await adminRes.json()
        const adminP1 = adminBody.data.products.find((p: any) => p.productId === "P1")
        expect(adminP1).toBeDefined()
        expect(adminP1.status).toBe("offSale")

        // Customer lists products -> P1 NOT visible
        const cusRes = await fetch(`${baseURL}/products`, { headers: NORMAL })
        expect(cusRes.status).toBe(200)
        const cusBody: any = await cusRes.json()
        const cusP1 = cusBody.data.products.find((p: any) => p.productId === "P1")
        expect(cusP1).toBeUndefined()
    })

    it("OP2-A3 (FR-1.3.2) Admin sees updated price and stock reflections", async () => {
        // Update P1 price to 500 and stock to 15
        await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 500, stock: 15 }),
        })

        const res = await fetch(`${baseURL}/products`, { headers: ADMIN })
        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.products.find((p: any) => p.productId === "P1")
        expect(p1.price).toBe(500)
        expect(p1.availableStock).toBe(15)
    })
})

describe("OP-2 listProducts (Admin) - Negative", () => {
    it("OP2-B1 (FR-0.2) missing token returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/products`)

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP2-B2 (FR-0.2) invalid/expired token returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/products`, {
            headers: { Authorization: "Bearer invalid-token-123" },
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP2-B3 unsupported POST /products returns error (no product creation operation)", async () => {
        const res = await fetch(`${baseURL}/products`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ name: "New Product", price: 100 }),
        })

        expect([403, 404, 405]).toContain(res.status)
    })
})

describe("OP-2 listProducts (Admin) - Boundary", () => {
    it("OP2-C1 (FR-1.3.2) product with stock = 0 is still visible to Admin (hidden from Customer)", async () => {
        // Admin updates P2 stock to 0
        await fetch(`${baseURL}/admin/products/P2`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: 0 }),
        })

        // Admin check: P2 visible with stock = 0
        const adminRes = await fetch(`${baseURL}/products`, { headers: ADMIN })
        expect(adminRes.status).toBe(200)
        const adminBody: any = await adminRes.json()
        const adminP2 = adminBody.data.products.find((p: any) => p.productId === "P2")
        expect(adminP2).toBeDefined()
        expect(adminP2.availableStock).toBe(0)

        // Customer check: P2 hidden because stock = 0
        const cusRes = await fetch(`${baseURL}/products`, { headers: NORMAL })
        expect(cusRes.status).toBe(200)
        const cusBody: any = await cusRes.json()
        const cusP2 = cusBody.data.products.find((p: any) => p.productId === "P2")
        expect(cusP2).toBeUndefined()
    })

    it("OP2-C2 (FR-1.3.2) product with stock = 1 (lower bound) is visible to both Admin and Customer", async () => {
        // Admin updates P2 stock to 1
        await fetch(`${baseURL}/admin/products/P2`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: 1 }),
        })

        // Admin check
        const adminRes = await fetch(`${baseURL}/products`, { headers: ADMIN })
        const adminBody: any = await adminRes.json()
        const adminP2 = adminBody.data.products.find((p: any) => p.productId === "P2")
        expect(adminP2).toBeDefined()
        expect(adminP2.availableStock).toBe(1)

        // Customer check
        const cusRes = await fetch(`${baseURL}/products`, { headers: NORMAL })
        const cusBody: any = await cusRes.json()
        const cusP2 = cusBody.data.products.find((p: any) => p.productId === "P2")
        expect(cusP2).toBeDefined()
        expect(cusP2.availableStock).toBe(1)
    })
})

