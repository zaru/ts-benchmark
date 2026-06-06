import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// better-sqlite3 はネイティブアドオンなので SSR バンドルから外し外部依存にする
	ssr: { external: ['better-sqlite3'] }
});
