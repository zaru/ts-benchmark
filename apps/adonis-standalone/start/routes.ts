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

router.get('/', () => {
  return { hello: 'world' }
})

/*
|--------------------------------------------------------------------------
| ベンチマーク用ルート
|--------------------------------------------------------------------------
|
| 素のネイティブ実装（/native）を公開する。
*/

// 素のネイティブ実装
router.get('/native', ({ response }) => response.json(payload))

/*
| 複雑ワークロード版（SQLite を複数回クエリしてアプリ側で集計する）。
|   GET /native-db … 素のネイティブ実装
*/
router.get('/native-db', async ({ response }) => response.json(await runWorkload()))

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
