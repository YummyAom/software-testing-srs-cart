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
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)

    NORMAL = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

describe("OP-17 setCouponStatus & OP-18 listCoupons - /admin/coupons", () => {
    it("OP17-A1 (AC-19a) admin disables coupon SAVE10 (FR-10.1.2)", async () => {
        const res = await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const save10 = body.data.coupons.find((c: any) => c.code === "SAVE10")
        expect(save10.status).toBe("inactive")
    })

    it("OP18-A1 (AC-19b) admin lists all coupons showing updated status (FR-10.2)", async () => {
        // Precondition -> admin disables SAVE10
        await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })

        const res = await fetch(`${baseURL}/admin/coupons`, {
            headers: ADMIN,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const save10 = body.data.coupons.find((c: any) => c.code === "SAVE10")
        expect(save10).toEqual({
            code: "SAVE10",
            percent: 10,
            minSpend: 1000,
            status: "inactive",
        })
    })

    it("OP17-A2 (AC-7) coupon disabled by admin is removed at checkout with notice (FR-10.1.3)", async () => {
        // Precondition -> cus_normal has P2 x 1 (1200 >= minSpend 1000), applies SAVE10
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })
        const couponRes = await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })
        expect(couponRes.status).toBe(200)

        // Admin disables SAVE10
        const disableRes = await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })
        expect(disableRes.status).toBe(200)

        // cus_normal checkouts
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        expect(checkoutRes.status).toBe(201)
        const checkoutBody: any = await checkoutRes.json()
        expect(checkoutBody.messages.map((m: any) => m.code)).toContain("COUPON_NOT_APPLICABLE")
        expect(checkoutBody.data.order.discount).toBe(0)
        expect(checkoutBody.data.order.shippingFee).toBe(30)
        expect(checkoutBody.data.order.netTotal).toBe(1230)
    }, 35000)

    it("OP17-A3 (FR-10.1.4) coupon status change does not alter existing created order", async () => {
        // Precondition -> cus_normal checkouts with active SAVE10
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId
        expect(checkoutBody.data.order.discount).toBe(120)

        // Admin disables SAVE10
        await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })

        // Assert order snapshot remains unchanged
        const orderRes = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: NORMAL,
        })
        expect(orderRes.status).toBe(200)
        const orderBody: any = await orderRes.json()
        expect(orderBody.data.discount).toBe(120)
        expect(orderBody.data.netTotal).toBe(1110)
        expect(orderBody.data.couponCode).toBe("SAVE10")
    }, 35000)

    it("OP17-B1 coupon not found when code does not exist (FR-10.1.1)", async () => {
        const res = await fetch(`${baseURL}/admin/coupons/NO_SUCH/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("COUPON_NOT_FOUND")
    })

    it("OP17-B2 validation error when status is invalid (VALIDATION_ERROR)", async () => {
        const res = await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "disabled" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP17-B3 customer cannot change coupon status (FR-0.3.2)", async () => {
        const res = await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })

    it("OP18-B1 customer cannot list admin coupons (FR-0.3.2)", async () => {
        const res = await fetch(`${baseURL}/admin/coupons`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})
