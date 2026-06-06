// workload.sqlite を決定的に生成する。
//
//   pnpm --filter @elysia-bench/workload seed
//
// 乱数は固定 seed の LCG（線形合同法）で生成し、Math.random は使わない。
// 生成物はリポジトリにコミットして、各アプリから既知パスで読めるようにする。
import { existsSync, unlinkSync } from "node:fs"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"

const DB_PATH = fileURLToPath(new URL("./workload.sqlite", import.meta.url))

// --- 決定的 PRNG（LCG）---
let state = 123456789
const next = () => {
  // glibc 系のパラメータ
  state = (state * 1103515245 + 12345) & 0x7fffffff
  return state
}
const randInt = (min: number, max: number) => min + (next() % (max - min + 1))
const pick = <T>(arr: readonly T[]) => arr[next() % arr.length]

// --- マスタ ---
const COUNTRIES = ["JP", "US", "GB", "DE", "FR", "BR", "IN"] as const
const FIRST = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"]
const LAST = ["ito", "sato", "tanaka", "smith", "jones", "muller", "dubois"]
const PRODUCTS = [
  "keyboard",
  "mouse",
  "monitor",
  "webcam",
  "headset",
  "laptop",
  "dock",
  "cable",
  "stand",
  "lamp",
] as const
const STATUSES = ["paid", "paid", "paid", "pending", "cancelled"] as const

const USER_COUNT = 40
const ORDER_COUNT = 300
const BASE_EPOCH = 1_700_000_000 // 固定基準時刻（リクエスト時刻には依存しない）

if (existsSync(DB_PATH)) unlinkSync(DB_PATH)

const db = new Database(DB_PATH)
// readonly 運用なので WAL は不要。単一ファイルのみコミットできるよう既定の journal を使う。

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL
  );
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL
  );
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_items_order ON order_items(order_id);
`)

const insertUser = db.prepare(
  "INSERT INTO users (id, name, country) VALUES (?, ?, ?)",
)
const insertOrder = db.prepare(
  "INSERT INTO orders (id, user_id, status, created_at) VALUES (?, ?, ?, ?)",
)
const insertItem = db.prepare(
  "INSERT INTO order_items (id, order_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)",
)

const seed = db.transaction(() => {
  for (let id = 1; id <= USER_COUNT; id++) {
    insertUser.run(id, `${pick(FIRST)}-${pick(LAST)}`, pick(COUNTRIES))
  }

  let itemId = 1
  for (let orderId = 1; orderId <= ORDER_COUNT; orderId++) {
    const userId = randInt(1, USER_COUNT)
    const status = pick(STATUSES)
    const createdAt = BASE_EPOCH + randInt(0, 90 * 24 * 60 * 60)
    insertOrder.run(orderId, userId, status, createdAt)

    const lines = randInt(1, 5)
    for (let l = 0; l < lines; l++) {
      const product = pick(PRODUCTS)
      const quantity = randInt(1, 4)
      const unitPrice = randInt(5, 200) * 100 // セント
      insertItem.run(itemId++, orderId, product, quantity, unitPrice)
    }
  }
})

seed()
db.close()

console.log(
  `seeded ${USER_COUNT} users / ${ORDER_COUNT} orders into ${DB_PATH}`,
)
