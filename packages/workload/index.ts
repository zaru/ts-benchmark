// 複雑ワークロード（DB 集計）の共有実装。
//
// 各アプリのエンドポイントは runWorkload() を 1 回呼ぶだけ。スキーマ・DB 接続・集計を
// このファイル 1 つに閉じている（payload パッケージと同じく相対 import を持たない自己完結
// 構成にして、nodenext な app からトランスパイルされても拡張子エラーを起こさないため）。
import { fileURLToPath } from "node:url"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import { eq, inArray } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// ---------------------------------------------------------------------------
// スキーマ（EC 風・中程度）
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
})

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  // "paid" | "pending" | "cancelled"
  status: text("status").notNull(),
  // epoch 秒（決定的シードで固定。リクエスト時刻には依存しない）
  createdAt: integer("created_at").notNull(),
})

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  // 単価（最小通貨単位 = セント相当の整数）
  unitPrice: integer("unit_price").notNull(),
})

export const schema = { users, orders, orderItems }

// ---------------------------------------------------------------------------
// DB 接続（ランタイムごとにネイティブドライバへ・遅延初期化）
// ---------------------------------------------------------------------------
//   Node : better-sqlite3 + drizzle-orm/better-sqlite3
//   Bun  : bun:sqlite      + drizzle-orm/bun-sqlite
//
// 接続は「最初の runWorkload() 呼び出し時」に 1 度だけ確立してキャッシュする。モジュール
// ロード時には接続しないので、full-stack のビルド時にサーバモジュールを評価されても
// ネイティブモジュール(better-sqlite3)を読み込まずに済む。動的 import を使うことで、
// バンドラは drizzle アダプタをバンドルに取り込みつつ better-sqlite3 を external に保てる。
type DB = BunSQLiteDatabase<typeof schema> | BetterSQLite3Database<typeof schema>

// バンドルされる full-stack アプリでは import.meta.url 由来の相対解決が崩れうるため、
// WORKLOAD_DB_PATH で絶対パスを上書きできるようにする（bench/run.sh が一括 export）。
const DB_PATH =
  process.env.WORKLOAD_DB_PATH ??
  fileURLToPath(new URL("./workload.sqlite", import.meta.url))

const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined"

let cached: DB | undefined

async function getDb(): Promise<DB> {
  if (cached) return cached
  if (isBun) {
    // "bun:sqlite" を文字列結合で組み立て、バンドラの静的解析による解決を防ぐ。
    const { Database } = await import(`${"bun"}:sqlite`)
    const { drizzle } = await import("drizzle-orm/bun-sqlite")
    cached = drizzle(new Database(DB_PATH, { readonly: true }), { schema })
  } else {
    const { default: Database } = await import("better-sqlite3")
    const { drizzle } = await import("drizzle-orm/better-sqlite3")
    cached = drizzle(new Database(DB_PATH, { readonly: true }), { schema })
  }
  return cached
}

// ---------------------------------------------------------------------------
// 集計ワークロード（複数クエリ + アプリ側整形）
// ---------------------------------------------------------------------------
//   1. status = 'paid' の注文を取得（クエリ1）
//   2. それらの注文明細を取得（クエリ2）
//   3. ユーザーを取得（クエリ3）
//   4. アプリ側で明細→注文→ユーザーを結合し、注文ごとの合計を算出
//   5. 国別売上の集計と、商品別数量ランキングを生成
//   6. すべて明示ソートで順序を固定し、決定的な summary を返す
//
// リクエスト時に時刻・乱数・暗黙の行順序へ依存しないため、同一 DB に対する出力は常に
// 同一バイト列になる（bench/run.sh の固定値検証が成立する）。
const TOP_PRODUCTS = 5

export async function runWorkload() {
  const db = await getDb()

  // --- クエリ1: 支払い済み注文 ---
  const paidOrders = db
    .select()
    .from(orders)
    .where(eq(orders.status, "paid"))
    .all()

  const orderIds = paidOrders.map((o) => o.id)

  // --- クエリ2: 対象注文の明細 ---
  const items =
    orderIds.length > 0
      ? db
          .select()
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .all()
      : []

  // --- クエリ3: ユーザー ---
  const allUsers = db.select().from(users).all()
  const userById = new Map(allUsers.map((u) => [u.id, u]))

  // --- アプリ側: 注文ごとの合計を集計 ---
  const itemsByOrder = new Map<number, typeof items>()
  for (const item of items) {
    const bucket = itemsByOrder.get(item.orderId)
    if (bucket) bucket.push(item)
    else itemsByOrder.set(item.orderId, [item])
  }

  let grandTotal = 0
  let itemCount = 0
  const revenueByCountry = new Map<string, number>()
  const quantityByProduct = new Map<string, number>()

  const orderSummaries = paidOrders.map((order) => {
    const orderItemsForOrder = itemsByOrder.get(order.id) ?? []
    let orderTotal = 0
    for (const item of orderItemsForOrder) {
      const lineTotal = item.quantity * item.unitPrice
      orderTotal += lineTotal
      itemCount += item.quantity
      quantityByProduct.set(
        item.productName,
        (quantityByProduct.get(item.productName) ?? 0) + item.quantity,
      )
    }
    grandTotal += orderTotal

    const user = userById.get(order.userId)
    const country = user?.country ?? "unknown"
    revenueByCountry.set(
      country,
      (revenueByCountry.get(country) ?? 0) + orderTotal,
    )

    return {
      orderId: order.id,
      userName: user?.name ?? "unknown",
      country,
      lineItems: orderItemsForOrder.length,
      total: orderTotal,
    }
  })

  // --- 整形: 明示ソートで順序を固定 ---
  // 国別売上は売上降順 → 国名昇順
  const byCountry = [...revenueByCountry.entries()]
    .map(([country, revenue]) => ({ country, revenue }))
    .sort((a, b) => b.revenue - a.revenue || a.country.localeCompare(b.country))

  // 商品別数量ランキング（上位 N）: 数量降順 → 商品名昇順
  const topProducts = [...quantityByProduct.entries()]
    .map(([productName, quantity]) => ({ productName, quantity }))
    .sort(
      (a, b) =>
        b.quantity - a.quantity || a.productName.localeCompare(b.productName),
    )
    .slice(0, TOP_PRODUCTS)

  // 注文サマリは注文 ID 昇順で固定
  orderSummaries.sort((a, b) => a.orderId - b.orderId)

  return {
    summary: {
      paidOrders: paidOrders.length,
      itemCount,
      grandTotal,
      averageOrderValue:
        paidOrders.length > 0 ? Math.round(grandTotal / paidOrders.length) : 0,
    },
    revenueByCountry: byCountry,
    topProducts,
    orders: orderSummaries,
  }
}
