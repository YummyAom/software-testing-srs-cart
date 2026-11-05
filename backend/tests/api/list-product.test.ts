import { describe, it, expect, beforeAll, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }

let NORMAL: Record<string, string>
let PRIME: Record<string, string>
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
    PRIME = await loginAs("cus_prime", process.env.SEED_PASSWORD_CUSTOMER_PRIME)
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
// OP-2: listProducts() - GET /products
// =============================================================================

describe("OP-2 listProducts", () => {
    it("OP2-A1 (FR-1.3.1) customer sees only available products with customer fields", async () => {
        // Precondition: reserve all P2 stock by another customer so availableStock of P2 becomes 0.
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 3 }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        expect(checkoutRes.status).toBe(201)

        const res = await fetch(`${baseURL}/products`, { headers: NORMAL })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(Array.isArray(body.data.products)).toBe(true)

        // customer response shape: no admin-only status field
        for (const p of body.data.products) {
            expect(typeof p.productId).toBe("string")
            expect(typeof p.name).toBe("string")
            expect(typeof p.price).toBe("number")
            expect(typeof p.weightGram).toBe("number")
            expect(typeof p.availableStock).toBe("number")
            expect(p.status).toBeUndefined()
        }

        // With P2 reserved to 0, customer list should not include P2.
        const ids = body.data.products.map((p: any) => p.productId)
        expect(ids).not.toContain("P2")
    })

    it("OP2-A2 (FR-1.3.2) admin sees all products with status field", async () => {
        const res = await fetch(`${baseURL}/products`, { headers: ADMIN })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(Array.isArray(body.data.products)).toBe(true)

        const ids = body.data.products.map((p: any) => p.productId)
        expect(ids).toEqual(expect.arrayContaining(["P1", "P2", "P3"]))

        for (const p of body.data.products) {
            expect(["onSale", "offSale"]).toContain(p.status)
        }
    })

    it("OP2-A3 (FR-8.5.2) customer can list products while in checkout stage", async () => {
        // move cus_normal to checkout stage
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
        expect(checkoutRes.status).toBe(201)

        const res = await fetch(`${baseURL}/products`, { headers: NORMAL })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(Array.isArray(body.data.products)).toBe(true)
    })

    it("OP2-B1 (FR-0.2) missing token returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/products`)

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })
})
