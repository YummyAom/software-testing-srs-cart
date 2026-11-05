import { describe, it, expect, beforeEach } from "vitest"

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
    PRIME = await loginAs("cus_prime", process.env.SEED_PASSWORD_CUSTOMER_PRIME)
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

// =============================================================================
// OP-5: removeItem(productId) - DELETE /cart/items/:productId
// =============================================================================

describe("OP-5 removeItem - Happy Path", () => {
    it("OP5-A1 (FR-2.7.3) remove one item from multi-item cart", async () => {
        // Precondition -> P1 x 1, P2 x 1 in cart
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        // Act -> remove P1
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(1)
        expect(body.data.lines.find((l: any) => l.productId === "P1")).toBeUndefined()
        expect(body.data.lines.find((l: any) => l.productId === "P2")).toBeDefined()
    })

    it("OP5-A2 (FR-2.7.3) remove deletes entire line, not just one piece", async () => {
        // Precondition -> P1 x 5, P2 x 1 in cart
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 5 }),
        })
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        // Act -> remove P1
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(1)
        expect(body.data.lines.find((l: any) => l.productId === "P1")).toBeUndefined()
    })

    it("OP5-A3 (FR-2.7.3) offSale item can still be removed from cart", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        // Admin turns P1 offSale
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        // Act -> remove P1
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lines.find((l: any) => l.productId === "P1")).toBeUndefined()
    })
})

describe("OP-5 removeItem - Negative", () => {
    it("OP5-B1 (FR-2.7.1) removing from empty cart returns 400 CART_EMPTY", async () => {
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("CART_EMPTY")
        expect(body.error.message).toContain("ไม่มีสินค้าให้ลบ")
    })

    it("OP5-B2 (FR-2.7.2) removing absent item from non-empty cart returns 404 ITEM_NOT_IN_CART", async () => {
        // cart has P1
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        // try to remove P2
        const res = await fetch(`${baseURL}/cart/items/P2`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("ITEM_NOT_IN_CART")
        expect(body.error.message).toContain("ไม่พบสินค้าในตะกร้า")
    })

    it("OP5-B3 (FR-2.7.1) empty cart + nonexistent productId returns 400 CART_EMPTY (empty cart checked first)", async () => {
        const res = await fetch(`${baseURL}/cart/items/P9`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("CART_EMPTY")
    })

    it("OP5-B4 (FR-8.1) removing item in stage checkout returns 400 OPERATION_NOT_ALLOWED", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("OPERATION_NOT_ALLOWED")
    })

    it("OP5-B5 (FR-0.2) missing authorization header returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP5-B6 (FR-0.3.1) Admin token returns 403 AUTH_FORBIDDEN", async () => {
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: ADMIN,
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})

describe("OP-5 removeItem - Boundary", () => {
    it("OP5-C1 (FR-2.7.4, FR-2.8) removing last item sets lineCount=0, checkoutEnabled=false, messages info", async () => {
        // cart has only P1 x 1
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        // Act -> remove last item
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(0)
        expect(body.data.lines).toEqual([])
        expect(body.data.checkoutEnabled).toBe(false)
        expect(body.messages).toEqual([
            { kind: "info", code: "", message: "ตะกร้าว่าง" },
        ])
    })

    it("OP5-C2 (FR-2.8) removing from 2 to 1 item keeps checkoutEnabled=true without empty cart message", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(1)
        expect(body.data.checkoutEnabled).toBe(true)
        expect(body.messages).toEqual([])
    })
})

