/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { Elysia } from 'elysia'
import { payload } from '@elysia-bench/payload'

router.get('/', () => {
  return { hello: 'world' }
})

/*
|--------------------------------------------------------------------------
| ベンチマーク用ルート
|--------------------------------------------------------------------------
|
| 他フレームワークと同様に「素のネイティブ実装 /native」と「Elysia 連携 /api」を
| 同一サーバ・同一ランタイム（Node）で公開する。
|
| AdonisJS は Web Fetch ネイティブではなく Node の req/res ベースなので、Elysia 連携は
| ハンドラ内で Web Request を合成して elysia.handle() に渡し、返ってきた Web Response を
| Adonis の response に書き戻す。
*/

// 素のネイティブ実装（Elysia なし）
router.get('/native', ({ response }) => response.json(payload))

// Elysia 連携（prefix /api、route / → /api）
const elysia = new Elysia({ prefix: '/api' }).get('/', () => payload)

router.get('/api', async ({ request, response }) => {
  const webRequest = new Request(request.completeUrl(true), {
    method: request.method(),
    headers: request.headers() as Record<string, string>,
  })
  const webResponse = await elysia.handle(webRequest)
  response.status(webResponse.status)
  webResponse.headers.forEach((value, key) => response.header(key, value))
  return response.send(await webResponse.text())
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
