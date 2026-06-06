// runWorkload() の出力を stdout に出す。bench/run.sh が複雑エンドポイントの
// 期待ペイロード（固定値検証の基準）を生成するために使う。
import { runWorkload } from "./index"

process.stdout.write(JSON.stringify(await runWorkload()))
