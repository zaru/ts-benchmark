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
import { payload } from '@elysia-bench/payload'
import { runWorkload } from '@elysia-bench/workload'

/*
|--------------------------------------------------------------------------
| ベンチマーク用ルート
|--------------------------------------------------------------------------
|
| AdonisJS は単体サーバ（Elysia 連携なし）として計測する。他の単体サーバ
| （Elysia / Hono / Express / NestJS）と揃え、単純エンドポイントを GET /、
| 複雑ワークロードを GET /db で公開する。
|
| ミドルウェアスタックの厚みは [`start/kernel.ts`](start/kernel.ts) で full / lean を
| 切り替える（ADONIS_BENCH_LEAN=1 で lean）。ルート定義はモードに依らず共通。
*/

// 単純エンドポイント（静的 JSON）
router.get('/', ({ response }) => response.json(payload))

// 複雑ワークロード（SQLite を複数回クエリしてアプリ側で集計する）
router.get('/db', async ({ response }) => response.json(await runWorkload()))

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
