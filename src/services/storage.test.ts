import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Bookmark } from '../types'

const bm = (id: string, extra: Partial<Bookmark> = {}): Bookmark =>
	({ id, title: `T${id}`, originalLink: `https://e.com/${id}`, categories: ['A'], ...extra }) as unknown as Bookmark

describe('diffBookmarks', () => {
	it('empty -> items = all adds', async () => {
		const { diffBookmarks } = await import('./storage')
		expect(diffBookmarks([], [bm('1'), bm('2')])).toEqual({ add: [bm('1'), bm('2')], update: [], remove: [] })
	})

	it('items -> empty = remove all (delete last bookmark)', async () => {
		const { diffBookmarks } = await import('./storage')
		expect(diffBookmarks([bm('1')], [])).toEqual({ add: [], update: [], remove: ['1'] })
	})

	it('edit sends the full changed bookmark as update', async () => {
		const { diffBookmarks } = await import('./storage')
		const edited = bm('1', { title: 'New' })
		expect(diffBookmarks([bm('1'), bm('2')], [edited, bm('2')])).toEqual({ add: [], update: [edited], remove: [] })
	})

	it('delete', async () => {
		const { diffBookmarks } = await import('./storage')
		expect(diffBookmarks([bm('1'), bm('2')], [bm('2')])).toEqual({ add: [], update: [], remove: ['1'] })
	})

	it('add', async () => {
		const { diffBookmarks } = await import('./storage')
		expect(diffBookmarks([bm('1')], [bm('1'), bm('2')])).toEqual({ add: [bm('2')], update: [], remove: [] })
	})

	it('reorder only = no ops', async () => {
		const { diffBookmarks } = await import('./storage')
		expect(diffBookmarks([bm('1'), bm('2')], [bm('2'), bm('1')])).toEqual({ add: [], update: [], remove: [] })
	})

	it('mixed', async () => {
		const { diffBookmarks } = await import('./storage')
		const edited = bm('2', { categories: ['B'] })
		expect(diffBookmarks([bm('1'), bm('2'), bm('3')], [edited, bm('3'), bm('4')])).toEqual({
			add: [bm('4')],
			update: [edited],
			remove: ['1'],
		})
	})
})

describe('storage (API mode)', () => {
	let fetchMock: ReturnType<typeof vi.fn>

	const load = async () => {
		vi.resetModules()
		vi.stubEnv('VITE_STORAGE_SECRET', 'secret')
		vi.stubEnv('VITE_STORAGE_API_URL', 'http://api.test')
		return (await import('./storage')).storage
	}
	const respond = (data: Bookmark[]) =>
		fetchMock.mockImplementation(async (_url: string, opts: RequestInit) => ({
			ok: true,
			json: async () => (opts.method === 'GET' ? { data } : { success: true }),
		}))
	const posts = () => fetchMock.mock.calls.filter(([, o]) => o.method === 'POST')

	beforeEach(() => {
		fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it('does nothing when data was never loaded', async () => {
		const storage = await load()
		await storage.saveBookmarks([])
		await storage.saveBookmarks([bm('1')])
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('reading the list does NOT enable sync until the app adopts it (partial load failure must not wipe the server)', async () => {
		const storage = await load()
		respond([bm('1'), bm('2')])
		await storage.getBookmarks() // e.g. categories failed afterwards, so the app never adopted this list
		await storage.saveBookmarks([])
		expect(posts()).toHaveLength(0)
	})

	it('sends only the diff to /bookmarks/ops', async () => {
		const storage = await load()
		respond([bm('1'), bm('2')])
		storage.markLoaded(await storage.getBookmarks())
		await storage.saveBookmarks([bm('2'), bm('3')])
		expect(posts()).toHaveLength(1)
		const [url, opts] = posts()[0]
		expect(url).toBe('http://api.test/bookmarks/ops')
		expect(JSON.parse(opts.body)).toEqual({ add: [bm('3')], update: [], remove: ['1'] })
	})

	it('deleting the last bookmark is persisted', async () => {
		const storage = await load()
		respond([bm('1')])
		storage.markLoaded(await storage.getBookmarks())
		await storage.saveBookmarks([])
		expect(JSON.parse(posts()[0][1].body)).toEqual({ add: [], update: [], remove: ['1'] })
	})

	it('no POST when nothing changed, and no resend after success', async () => {
		const storage = await load()
		respond([bm('1')])
		storage.markLoaded(await storage.getBookmarks())
		await storage.saveBookmarks([bm('1')])
		expect(posts()).toHaveLength(0)
		await storage.saveBookmarks([bm('1'), bm('2')])
		await storage.saveBookmarks([bm('1'), bm('2')])
		expect(posts()).toHaveLength(1)
	})

	it('after a failure the next call resends the same diff', async () => {
		const storage = await load()
		respond([bm('1')])
		storage.markLoaded(await storage.getBookmarks())
		fetchMock.mockRejectedValueOnce(new Error('down'))
		await expect(storage.saveBookmarks([])).rejects.toThrow()
		await storage.saveBookmarks([])
		expect(posts()).toHaveLength(2)
		expect(JSON.parse(posts()[1][1].body)).toEqual({ add: [], update: [], remove: ['1'] })
	})

	it('serializes overlapping calls so lastSynced never goes backwards', async () => {
		const storage = await load()
		respond([])
		storage.markLoaded(await storage.getBookmarks())
		await Promise.all([storage.saveBookmarks([bm('1')]), storage.saveBookmarks([bm('1'), bm('2')])])
		expect(posts().map(([, o]) => JSON.parse(o.body))).toEqual([
			{ add: [bm('1')], update: [], remove: [] },
			{ add: [bm('2')], update: [], remove: [] },
		])
	})

	it('clearBookmarks sets lastSynced to empty', async () => {
		const storage = await load()
		respond([bm('1')])
		storage.markLoaded(await storage.getBookmarks())
		await storage.clearBookmarks()
		expect(JSON.parse(posts()[0][1].body)).toEqual({ remove: ['1'], force: true })
		expect(posts()[1][0]).toBe('http://api.test/deleted')
		expect(JSON.parse(posts()[1][1].body)).toEqual({ data: [], replace: true })
		fetchMock.mockClear()
		await storage.saveBookmarks([bm('9')])
		expect(JSON.parse(posts()[0][1].body)).toEqual({ add: [bm('9')], update: [], remove: [] })
	})
})

describe('storage (localStorage mode)', () => {
	it('saves the full array to localStorage', async () => {
		vi.resetModules()
		vi.stubEnv('VITE_STORAGE_SECRET', '')
		const store = new Map<string, string>()
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
			removeItem: (k: string) => void store.delete(k),
		})
		const { storage } = await import('./storage')
		await storage.saveBookmarks([bm('1')])
		expect(JSON.parse(localStorage.getItem('universal-bookmarks-data')!)).toEqual([bm('1')])
		await storage.saveBookmarks([])
		expect(JSON.parse(localStorage.getItem('universal-bookmarks-data')!)).toEqual([])
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})
})
