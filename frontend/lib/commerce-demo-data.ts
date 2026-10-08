export type ProductStatus = "onSale" | "offSale"

export type DemoProduct = {
  id: string
  name: string
  price: number
  weightGrams: number
  stock: number
  status: ProductStatus
}

export const demoProducts: DemoProduct[] = [
  {
    id: "prod-101",
    name: "สินค้าตัวอย่าง A",
    price: 120,
    weightGrams: 300,
    stock: 18,
    status: "onSale",
  },
  {
    id: "prod-102",
    name: "สินค้าตัวอย่าง B",
    price: 250,
    weightGrams: 500,
    stock: 0,
    status: "offSale",
  },
  {
    id: "prod-103",
    name: "สินค้าตัวอย่าง C",
    price: 89,
    weightGrams: 150,
    stock: 7,
    status: "onSale",
  },
  {
    id: "prod-104",
    name: "สินค้าตัวอย่าง D",
    price: 310,
    weightGrams: 1000,
    stock: 4,
    status: "offSale",
  },
]

export const catalogProducts = demoProducts.filter(
  (product) => product.status === "onSale" && product.stock > 0,
)

export type DemoOrderStatus = "paid" | "pending" | "failed"

export type DemoOrderLine = {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export type DemoOrder = {
  id: string
  createdAt: string
  status: DemoOrderStatus
  lines: DemoOrderLine[]
  subtotal: number
  discount: number
  shipping: number
  total: number
  couponCode: string
}

export const demoOrders: DemoOrder[] = [
  {
    id: "ORD-DEMO-001",
    createdAt: "8 ต.ค. 2569",
    status: "paid",
    lines: [
      {
        productId: "prod-101",
        name: "สินค้าตัวอย่าง A",
        unitPrice: 120,
        quantity: 2,
        lineTotal: 240,
      },
      {
        productId: "prod-102",
        name: "สินค้าตัวอย่าง B",
        unitPrice: 250,
        quantity: 1,
        lineTotal: 250,
      },
    ],
    subtotal: 490,
    discount: 0,
    shipping: 35,
    total: 525,
    couponCode: "",
  },
  {
    id: "ORD-DEMO-002",
    createdAt: "7 ต.ค. 2569",
    status: "pending",
    lines: [
      {
        productId: "prod-103",
        name: "สินค้าตัวอย่าง C",
        unitPrice: 89,
        quantity: 1,
        lineTotal: 89,
      },
    ],
    subtotal: 89,
    discount: 0,
    shipping: 75,
    total: 164,
    couponCode: "",
  },
  {
    id: "ORD-DEMO-003",
    createdAt: "6 ต.ค. 2569",
    status: "failed",
    lines: [
      {
        productId: "prod-104",
        name: "สินค้าตัวอย่าง D",
        unitPrice: 310,
        quantity: 1,
        lineTotal: 310,
      },
    ],
    subtotal: 310,
    discount: 0,
    shipping: 45,
    total: 355,
    couponCode: "",
  },
]

export const cartPreview = {
  lines: [
    {
      productId: "prod-101",
      name: "สินค้าตัวอย่าง A",
      unitPrice: 120,
      quantity: 2,
      available: true,
    },
    {
      productId: "prod-102",
      name: "สินค้าตัวอย่าง B",
      unitPrice: 250,
      quantity: 1,
      available: false,
    },
  ],
  couponCode: "",
  subtotal: 490,
  discount: 0,
  shipping: 35,
  total: 525,
  zone: "inCity",
  speed: "standard",
}

export const demoCoupons = [
  { code: "EXAMPLE10", percent: 10, minSpend: 500, status: "active" },
  { code: "EXAMPLE15", percent: 15, minSpend: 1000, status: "inactive" },
] as const

export const scaffoldNotice =
  "โหมดตัวอย่าง: ข้อมูลในหน้านี้ใช้จัดวาง UI เท่านั้น ยังไม่ได้เชื่อมต่อ api-server และปุ่มที่เปลี่ยนข้อมูลยังปิดใช้งาน"

export function formatTHB(amount: number) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(amount)} บาท`
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value)
}
