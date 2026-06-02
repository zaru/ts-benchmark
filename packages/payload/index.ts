// 両エンドポイントが返す共通 JSON ペイロード。
// ペイロード差による不公平を排除するため一箇所で定義する。
export const payload = {
  message: "Hello Elysia",
  framework: "elysia",
  items: [
    { id: 1, name: "alpha", active: true },
    { id: 2, name: "beta", active: false },
    { id: 3, name: "gamma", active: true },
  ],
  meta: { count: 3, version: "1.0.0" },
}
