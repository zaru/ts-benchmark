/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/*
|--------------------------------------------------------------------------
| ベンチマーク用の lean / full 切替
|--------------------------------------------------------------------------
|
| AdonisJS は HTTP アダプタを差し替えられず（常に Node 標準 http）、公式ランタイムも
| Node のみなので、性能比較で意味のある「モード」はミドルウェアスタックの厚みだけ。
| そこで環境変数 ADONIS_BENCH_LEAN=1 のときは api スターターキット既定のミドルウェア
| （bodyparser / session / shield / 認証初期化 / CORS / force_json）を外し、他フレーム
| ワークの素の native と同条件（純粋なルーティング + シリアライズ）に揃える。
|
|   full（既定, port 3005） … 実運用の api スターター構成のままのコスト
|   lean（=1,   port 3015） … 既定ミドルウェアを剥がした AdonisJS 本体のルーティングコスト
|
| 2 つを並べることで「フレームワーク本体の速さ」と「既定ミドルウェアの上乗せ分」を
| 分離できる。lean では認証系ルート（/api/v1/*）は正しく動かなくなるが、ベンチは
| / と /db しか叩かないため計測には影響しない。
*/
const lean = process.env.ADONIS_BENCH_LEAN === '1'

if (lean) {
  // フレームワークが動作する最低限（HttpContext 等のコンテナ束縛）だけ残す。
  server.use([() => import('#middleware/container_bindings_middleware')])
  router.use([])
} else {
  /**
   * The server middleware stack runs middleware on all the HTTP
   * requests, even if there is no route registered for
   * the request URL.
   */
  server.use([
    () => import('#middleware/force_json_response_middleware'),
    () => import('#middleware/container_bindings_middleware'),
    () => import('@adonisjs/cors/cors_middleware'),
  ])

  /**
   * The router middleware stack runs middleware on all the HTTP
   * requests with a registered route.
   */
  router.use([
    () => import('@adonisjs/core/bodyparser_middleware'),
    () => import('@adonisjs/session/session_middleware'),
    () => import('@adonisjs/shield/shield_middleware'),
    () => import('@adonisjs/auth/initialize_auth_middleware'),
    () => import('#middleware/silent_auth_middleware'),
  ])
}

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
})
