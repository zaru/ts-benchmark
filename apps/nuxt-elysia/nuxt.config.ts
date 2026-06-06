// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // better-sqlite3 はネイティブアドオンなので Nitro のバンドルから外し外部依存にする
  nitro: {
    externals: {
      external: ['better-sqlite3'],
    },
  },
})
