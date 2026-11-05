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
// OP-6: applyCoupon(code) - PUT /cart/coupon
// =============================================================================

describe("OP-6 applyCoupon - Happy Path", () => {
    it("OP6-A1 (FR-3.2.1) apply active coupon to cart meeting minSpend", async () => {
        // P2 is 1200 >= minSpend 1000
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.couponCode).toBe("SAVE10")
    })

    it("OP6-A2 (FR-3.2.3) apply coupon to empty cart succeeds", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.couponCode).toBe("SAVE10")
        expect(body.data.lineCount).toBe(0)
    })

    it("OP6-A3 (FR-3.2.2) apply coupon when subtotal < minSpend succeeds (minSpend checked at checkout)", async () => {
        // P1 is 450 < minSpend 1000
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.couponCode).toBe("SAVE10")
    })

    it("OP6-A4 (FR-3.2.1) re-applying same coupon succeeds idempotent", async () => {
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.couponCode).toBe("SAVE10")
    })

    it("OP6-A5 (FR-3.3) coupon can be used by multiple customers simultaneously", async () => {
        const resNormal = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })
        const resPrime = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(resNormal.status).toBe(200)
        expect(resPrime.status).toBe(200)

        const bodyNormal: any = await resNormal.json()
        const bodyPrime: any = await resPrime.json()
        expect(bodyNormal.data.couponCode).toBe("SAVE10")
        expect(bodyPrime.data.couponCode).toBe("SAVE10")
    })
})

describe("OP-6 applyCoupon - Negative", () => {
    it("OP6-B1 (FR-3.1.2) nonexistent coupon code returns 400 COUPON_INVALID", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "NOPE" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_INVALID")
    })

    it("OP6-B2 (FR-3.1.2) inactive coupon returns 400 COUPON_INVALID", async () => {
        // Admin disables SAVE10
        await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })

        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_INVALID")
    })

    it("OP6-B3 (FR-3.1.2) empty body or missing code returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP6-B4 (FR-3.1.2, FR-0.7) invalid code when coupon bound leaves previous coupon intact", async () => {
        // Bind SAVE10 first
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        // Try binding invalid code
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "INVALID" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_INVALID")

        // Assert SAVE10 is still bound
        const cartRes = await fetch(`${baseURL}/cart`, { headers: NORMAL })
        const cart: any = await cartRes.json()
        expect(cart.data.couponCode).toBe("SAVE10")
    })

    it("OP6-B5 (FR-8.1) applying coupon in stage checkout returns 400 OPERATION_NOT_ALLOWED", async () => {
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

        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("OPERATION_NOT_ALLOWED")
    })

    it("OP6-B6 (FR-0.2) missing authorization header returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: JSON_HDR,
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP6-B7 (FR-0.3.1) Admin token returns 403 AUTH_FORBIDDEN", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})

describe("OP-6 applyCoupon - Boundary", () => {
    it("OP6-C1 (FR-3.1.1) lowercase coupon code returns 400 COUPON_INVALID (case-sensitive)", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "save10" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_INVALID")
    })

    it("OP6-C2 (FR-3.1.1) trailing space returns 400 COUPON_INVALID", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10 " }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_INVALID")
    })

    it("OP6-C3 (FR-3.1.1) coupon code missing last character returns 400 COUPON_INVALID", async () => {
        const res = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE1" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_INVALID")
    })
})

