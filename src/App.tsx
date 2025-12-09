import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
	Upload,
	X,
	Edit2,
	Trash2,
	Plus,
	Settings,
	Twitter,
	Link as LinkIcon,
	Download,
	FileDown,
	Hash,
	Menu,
	Calendar,
	User,
	Search,
} from 'lucide-react'
import type { Bookmark, Category, TweetRaw, LogEntry } from './types'
import { processBookmarksWithGemini } from './services/geminiService'
import { storage } from './services/storage'
import { Button, Input, Label, TextArea, Badge, Modal } from './components/UI'
import { TrialCountdown } from './components/TrialCountdown'
import { strings } from './translations'

// --- Helper Components ---

const BookmarkCard: React.FC<{
	bookmark: Bookmark
	onEdit: (b: Bookmark) => void
	onDelete: (id: string, originalId: string) => void
}> = ({ bookmark, onEdit, onDelete }) => {
	// Extract original ID for blacklist purposes
	const originalId = bookmark.originalLink.split('/').pop() || ''

	// Format Date: YYYY-MM-DD
	const dateStr = new Date(bookmark.createdAt).toISOString().split('T')[0]

	return (
		<div className='bg-white border-2 border-black p-5 h-full flex flex-col shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200'>
			<div className='flex justify-between items-start mb-2'>
				<div className='flex flex-wrap gap-1.5'>
					{bookmark.categories.map((cat, idx) => (
						<Badge key={idx} color='bg-cyan-300'>
							{cat}
						</Badge>
					))}
				</div>
				<div className='flex gap-2'>
					<button
						onClick={(e) => {
							e.stopPropagation()
							onEdit(bookmark)
						}}
						className='p-1.5 hover:bg-yellow-300 border border-transparent hover:border-black transition-colors'
						title={strings.modal.editTitle}
					>
						<Edit2 size={16} />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation()
							onDelete(bookmark.id, originalId)
						}}
						className='p-1.5 hover:bg-red-500 hover:text-white border border-transparent hover:border-black transition-colors'
						title={strings.modal.deleteTitle}
					>
						<Trash2 size={16} />
					</button>
				</div>
			</div>

			{/* Meta Info: Date & Author */}
			<div className='flex flex-wrap gap-3 mb-3 text-xs font-mono text-gray-500 border-b border-gray-200 pb-2'>
				<div className='flex items-center gap-1'>
					<Calendar size={12} />
					<span>{dateStr}</span>
				</div>
				{bookmark.author &&
					bookmark.author !== 'Unknown' &&
					(() => {
						// Parse author format: "Real Name@username" or "@username"
						const authorParts = bookmark.author.split('@')
						const realName = authorParts[0]?.trim()
						const username = authorParts[1]?.trim()

						return (
							<div className='flex gap-1 font-bold text-black'>
								<User size={12} />
								<div className='flex flex-col leading-tight'>
									{realName && <span className='text-gray-700'>{realName}</span>}
									{username && <span className='text-black'>@{username}</span>}
									{!username && !realName && <span>@{bookmark.author}</span>}
								</div>
							</div>
						)
					})()}
			</div>

			<h3 className='font-bold text-xl leading-tight mb-3'>{bookmark.title}</h3>

			{/* Raw Text Description */}
			<p className='text-gray-700 font-mono mb-6 flex-grow leading-relaxed text-sm whitespace-pre-wrap break-words'>
				{bookmark.description}
			</p>

			<div className='mt-auto pt-4 border-t-2 border-black/10 flex flex-col gap-3'>
				<a
					href={bookmark.originalLink}
					target='_blank'
					rel='noopener noreferrer'
					className='text-xs font-bold uppercase flex items-center gap-2 hover:bg-black hover:text-white w-fit px-2 py-1 transition-colors border border-black'
				>
					<Twitter size={14} /> {strings.app.viewOriginal}
				</a>

				{bookmark.externalLinks.length > 0 && (
					<div className='flex flex-col gap-1.5'>
						{bookmark.externalLinks.map((link, idx) => (
							<a
								key={idx}
								href={link}
								target='_blank'
								rel='noopener noreferrer'
								className='text-xs text-blue-700 truncate flex items-center gap-2 hover:underline decoration-2'
							>
								<LinkIcon size={12} /> {new URL(link).hostname}
							</a>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

// --- Main App ---

export default function App() {
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [deletedIds, setDeletedIds] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [progress, setProgress] = useState({ current: 0, total: 0 })
	const [logs, setLogs] = useState<LogEntry[]>([])

	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)

	// Helper to toggle category and ensure at least one category exists
	const toggleCategory = (cat: string, isChecked: boolean, currentCategories: string[]): string[] => {
		const newCategories = isChecked
			? [...currentCategories, cat]
			: currentCategories.filter(c => c !== cat)
		return newCategories.length > 0 ? newCategories : ['Altres']
	}
	const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
	const [newCategoryName, setNewCategoryName] = useState('')
	const [newBookmarkMode, setNewBookmarkMode] = useState(false)
	const [rejectedTweets, setRejectedTweets] = useState<TweetRaw[]>([])

	// Drag and drop state for categories
	const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null)
	const [dragOverCategoryIndex, setDragOverCategoryIndex] = useState<number | null>(null)

	// Review Modal States
	const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
	const [selectedTweetsForReview, setSelectedTweetsForReview] = useState<Set<string>>(new Set())
	const [tweetsToEdit, setTweetsToEdit] = useState<TweetRaw[]>([])
	const [currentEditIndex, setCurrentEditIndex] = useState(0)

	// Carousel Modal State (new flow)
	const [isCarouselModalOpen, setIsCarouselModalOpen] = useState(false)
	const [carouselTweets, setCarouselTweets] = useState<TweetRaw[]>([])
	const [carouselIndex, setCarouselIndex] = useState(0)
	const [editedTweetsInCarousel, setEditedTweetsInCarousel] = useState<Bookmark[]>([])

	// Pending review state (persisted)
	const [hasPendingReview, setHasPendingReview] = useState(false)

	// Mobile Menu State
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

	// Search Modal State
	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<Bookmark[]>([])

	// Custom Delete Modal State
	const [deleteModalState, setDeleteModalState] = useState<{
		isOpen: boolean
		id: string | null
		originalId: string | null
	}>({
		isOpen: false,
		id: null,
		originalId: null,
	})

	// Generic Confirmation Modal State
	const [confirmModal, setConfirmModal] = useState<{
		isOpen: boolean
		title: string
		message: string
		onConfirm: () => void
		isDanger?: boolean
	} | null>(null)

	// Result/Alert Modal State
	const [resultModal, setResultModal] = useState<{ title: string; message: string } | null>(null)

	const abortControllerRef = useRef<AbortController | null>(null)
	const logsEndRef = useRef<HTMLDivElement>(null)

	// Auto-scroll logs
	useEffect(() => {
		logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [logs])

	// Load Data on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				const [loadedBookmarks, loadedCategories, loadedDeletedIds] = await Promise.all([
					storage.getBookmarks(),
					storage.getCategories(),
					storage.getDeletedIds(),
				])
				// Migrate old bookmarks: category (string) → categories (array)
				const migratedBookmarks = loadedBookmarks.map((b: any) => {
					if (!b.categories && b.category) {
						// Old format: has 'category' field
						return { ...b, categories: [b.category], category: undefined }
					} else if (!b.categories) {
						// No categories at all, assign default
						return { ...b, categories: ['Altres'] }
					}
					return b
				})

				setBookmarks(migratedBookmarks)
				setCategories(loadedCategories)
				setDeletedIds(loadedDeletedIds)

				// Save migrated data if changes were made
				if (migratedBookmarks.some((b: any, i: number) => b !== loadedBookmarks[i])) {
					storage.saveBookmarks(migratedBookmarks)
				}

				// Check for search query in URL
				const urlParams = new URLSearchParams(window.location.search)
				const searchParam = urlParams.get('search')
				if (searchParam) {
					setSearchQuery(searchParam)
					// Perform search with loaded bookmarks
					const lowerQuery = searchParam.toLowerCase().trim()
					const results = loadedBookmarks.filter((bookmark) => {
						const titleMatch = bookmark.title.toLowerCase().includes(lowerQuery)
						const descriptionMatch = bookmark.description.toLowerCase().includes(lowerQuery)
						const authorMatch = bookmark.author.toLowerCase().includes(lowerQuery)
						return titleMatch || descriptionMatch || authorMatch
					})
					setSearchResults(results)
				}
			} catch (error) {
				console.error('Failed to load data', error)
				setCategories(strings.defaults.categories)
			}
		}
		loadData()
	}, [])

	// Save Data when changed
	useEffect(() => {
		if (bookmarks.length > 0) storage.saveBookmarks(bookmarks)
	}, [bookmarks])

	useEffect(() => {
		if (categories.length > 0) storage.saveCategories(categories)
	}, [categories])

	useEffect(() => {
		storage.saveDeletedIds(deletedIds)
	}, [deletedIds])

	const addLog = (message: string, type: LogEntry['type'] = 'info') => {
		setLogs((prev) => [
			...prev,
			{
				timestamp: new Date().toLocaleTimeString(),
				message,
				type,
			},
		])
	}

	const closeResultModal = () => {
		setResultModal(null)
		// Clear logs when closing the final result modal to clean up the UI
		setLogs([])
	}

	const handleExport = () => {
		const backup = {
			backupVersion: 1,
			timestamp: Date.now(),
			categories,
			bookmarks,
			deletedIds, // Include blacklist in backup
		}

		const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `ai-bookmarks-backup-${new Date().toISOString().split('T')[0]}.json`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	const handleDownloadRejected = () => {
		if (rejectedTweets.length === 0) return

		const blob = new Blob([JSON.stringify(rejectedTweets, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `non-ai-tweets-${new Date().toISOString().split('T')[0]}.json`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	const handleStop = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
			abortControllerRef.current = null
		}
		setIsLoading(false)
		addLog(strings.logs.stopped, 'error')
	}

	const handleResetData = () => {
		setConfirmModal({
			isOpen: true,
			title: strings.modal.attentionTitle,
			message: strings.alerts.confirmReset,
			isDanger: true,
			onConfirm: async () => {
				await storage.clearData()
				setBookmarks([])
				setCategories(strings.defaults.categories)
				setRejectedTweets([])
				setDeletedIds([])
				setConfirmModal(null)
				window.location.reload()
			},
		})
	}

	const processTweetsData = async (tweets: TweetRaw[], signal: AbortSignal) => {
		if (tweets.length === 0) {
			setResultModal({
				title: strings.modal.attentionTitle,
				message: strings.alerts.noValidTweets,
			})
			setIsLoading(false)
			return
		}

		addLog(strings.logs.start, 'info')

		// --- DEDUPLICATION & BLACKLIST LOGIC ---

		const existingIds = new Set(
			bookmarks.map((b) => {
				const parts = b.originalLink.split('/')
				return parts[parts.length - 1]
			})
		)

		const blacklistIds = new Set(deletedIds)

		const uniqueTweets = tweets.filter((t) => {
			const id = t.id_str || t.id
			if (!id) return false
			return !existingIds.has(String(id)) && !blacklistIds.has(String(id))
		})

		const skippedCount = tweets.length - uniqueTweets.length

		if (uniqueTweets.length === 0) {
			const msg = strings.alerts.importResult
				.replace('{0}', '0')
				.replace('{1}', String(skippedCount))
				.replace('{2}', '0')
			addLog(msg, 'warning')
			setResultModal({
				title: strings.modal.successTitle,
				message: msg,
			})
			setIsLoading(false)
			return
		}

		try {
			const processed = await processBookmarksWithGemini(
				uniqueTweets,
				categories,
				(c, t) => setProgress({ current: c, total: t }),
				addLog,
				signal
			)

			const aiResults = processed.filter((p) => p.isAI)
			const nonAiIds = new Set(processed.filter((p) => !p.isAI).map((p) => p.originalId))

			const newRejectedTweets = uniqueTweets.filter((t) => {
				const id = t.id_str || t.id
				return id && nonAiIds.has(String(id))
			})

			setRejectedTweets((prev) => [...prev, ...newRejectedTweets])

			const newItems: Bookmark[] = aiResults.map((p) => {
				// Find original tweet to get text fallback
				const originalTweet = uniqueTweets.find((t) => (t.id_str || t.id) === p.originalId)

				// Raw Text logic with truncation
				const originalText = originalTweet?.full_text || originalTweet?.text || ''
				const TRUNC_LIMIT = 280
				const description =
					originalText.length > TRUNC_LIMIT ? originalText.substring(0, TRUNC_LIMIT) + ' [...]' : originalText

				// Extract Author Logic
				let author = strings.defaults.unknownAuthor
				if (originalTweet?.author) {
					// Format: "Name@username·date" - extract part before "·"
					const beforeDot = originalTweet.author.split('·')[0]
					author = beforeDot.trim()
				} else if (originalTweet?.user?.screen_name) {
					author = originalTweet.user.screen_name
				} else if (originalTweet?.user?.name) {
					author = originalTweet.user.name
				}

				// Extract Date
				let createdAt = Date.now()
				if (originalTweet?.created_at) {
					const parsedDate = new Date(originalTweet.created_at)
					if (!isNaN(parsedDate.getTime())) {
						createdAt = parsedDate.getTime()
					}
				}

				return {
					id: p.originalId + Math.random().toString(36).substr(2, 9),
					title: p.title || strings.defaults.untitled,
					description: description || strings.defaults.noDescription,
					author: author,
					categories: p.categories && p.categories.length > 0
				? p.categories.filter(cat => categories.includes(cat))
				: [strings.defaults.uncategorized],
					externalLinks: p.externalLinks || [],
					originalLink: `https://twitter.com/i/web/status/${p.originalId}`,
					createdAt: createdAt,
				}
			})

			const updatedBookmarks = [...bookmarks, ...newItems]
			setBookmarks(updatedBookmarks)
			storage.saveBookmarks(updatedBookmarks)

			addLog(strings.logs.finished, 'success')
			setIsLoading(false)

			// If there are rejected tweets, open review modal instead of showing result
			if (newRejectedTweets.length > 0) {
				setHasPendingReview(true)
				setIsReviewModalOpen(true)
			} else {
				setResultModal({
					title: strings.modal.successTitle,
					message: strings.alerts.importResult
						.replace('{0}', String(newItems.length))
						.replace('{1}', String(skippedCount))
						.replace('{2}', String(newRejectedTweets.length)),
				})
			}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				console.log('Processing aborted by user')
			} else {
				console.error('Processing error', error)
				addLog(strings.alerts.genericError + ': ' + error.message, 'error')
				setIsLoading(false)
			}
		}
	}

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		setIsLoading(true)
		setLogs([])
		setProgress({ current: 0, total: 0 })

		const controller = new AbortController()
		abortControllerRef.current = controller

		const reader = new FileReader()
		reader.onload = async (event) => {
			try {
				const text = event.target?.result as string
				let rawData: any = JSON.parse(text)

				// --- CHECK IF IT IS A BACKUP ---
				if (rawData.backupVersion && rawData.bookmarks && rawData.categories) {
					addLog('Fitxer de còpia de seguretat detectat.', 'info')
					const newCats = Array.from(new Set([...categories, ...rawData.categories]))
					setCategories(newCats)
					storage.saveCategories(newCats)

					if (rawData.deletedIds) {
						const newDeleted = Array.from(new Set([...deletedIds, ...rawData.deletedIds]))
						setDeletedIds(newDeleted)
					}

					const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]))
					let addedCount = 0
					let skippedCount = 0

					;(rawData.bookmarks as Bookmark[]).forEach((b) => {
						if (bookmarkMap.has(b.id)) {
							skippedCount++
						} else {
							bookmarkMap.set(b.id, b)
							addedCount++
						}
					})

					const newBookmarks = Array.from(bookmarkMap.values())
					setBookmarks(newBookmarks)
					storage.saveBookmarks(newBookmarks)

					const msg = strings.alerts.backupMerge
						.replace('{0}', String(addedCount))
						.replace('{1}', String(skippedCount))
					addLog(msg, 'success')
					setResultModal({
						title: strings.modal.successTitle,
						message: msg,
					})
					setIsLoading(false)
					return
				}

				// --- TREAT AS TWITTER ARCHIVE ---
				let tweets: TweetRaw[] = []
				if (Array.isArray(rawData)) {
					tweets = rawData
				} else if (rawData.bookmarks && Array.isArray(rawData.bookmarks)) {
					tweets = rawData.bookmarks
				} else {
					const possibleArray = Object.values(rawData).find((val) => Array.isArray(val))
					if (possibleArray) tweets = possibleArray as TweetRaw[]
				}

				await processTweetsData(tweets, controller.signal)
			} catch (error) {
				console.error('Error parsing file:', error)
				setResultModal({
					title: strings.modal.errorTitle,
					message: strings.alerts.importError,
				})
				setIsLoading(false)
			} finally {
				e.target.value = ''
				abortControllerRef.current = null
			}
		}
		reader.readAsText(file)
	}

	const requestDelete = (id: string, originalId: string) => {
		setDeleteModalState({ isOpen: true, id, originalId })
	}

	const confirmDelete = () => {
		if (!deleteModalState.id) return
		setBookmarks((prev) => prev.filter((b) => b.id !== deleteModalState.id))
		if (deleteModalState.originalId) {
			setDeletedIds((prev) => [...prev, deleteModalState.originalId!])
		}
		setDeleteModalState({ isOpen: false, id: null, originalId: null })
	}

	const openEditModal = (bookmark: Bookmark) => {
		setEditingBookmark({ ...bookmark })
		setNewBookmarkMode(false)
		setIsEditModalOpen(true)
	}

	const openNewBookmarkModal = () => {
		setEditingBookmark({
			id: Math.random().toString(36).substr(2, 9),
			title: '',
			description: '',
			author: '',
			categories: [categories[0] || strings.defaults.uncategorized],
			externalLinks: [],
			originalLink: '',
			createdAt: Date.now(),
		})
		setNewBookmarkMode(true)
		setIsEditModalOpen(true)
	}

	const saveBookmark = () => {
		if (!editingBookmark) return
		setBookmarks((prev) => {
			let next
			if (newBookmarkMode) {
				next = [editingBookmark, ...prev]
			} else {
				next = prev.map((b) => (b.id === editingBookmark.id ? editingBookmark : b))
			}
			return next
		})
		setIsEditModalOpen(false)
		setEditingBookmark(null)
	}

	// Review Modal Handlers
	const toggleTweetSelection = (tweetId: string) => {
		setSelectedTweetsForReview((prev) => {
			const next = new Set(prev)
			if (next.has(tweetId)) {
				next.delete(tweetId)
			} else {
				next.add(tweetId)
			}
			return next
		})
	}

	const handleConfirmReview = () => {
		const selected = rejectedTweets.filter((t) => {
			const id = t.id_str || t.id
			return id && selectedTweetsForReview.has(String(id))
		})

		if (selected.length === 0) {
			// No tweets selected, just close and show result modal
			setIsReviewModalOpen(false)
			setSelectedTweetsForReview(new Set())
			const addedCount = bookmarks.length
			setResultModal({
				title: strings.modal.successTitle,
				message: strings.alerts.importResult
					.replace('{0}', String(addedCount))
					.replace('{1}', '0')
					.replace('{2}', String(rejectedTweets.length)),
			})
			return
		}

		// Open carousel modal with selected tweets
		setCarouselTweets(selected)
		setCarouselIndex(0)
		setEditedTweetsInCarousel([])
		setIsReviewModalOpen(false)
		setIsCarouselModalOpen(true)

		// Prepare first tweet for editing
		const firstTweet = selected[0]
		prepareCarouselTweetForEdit(firstTweet)
	}

	// Carousel functions
	const prepareCarouselTweetForEdit = (tweet: TweetRaw) => {
		const tweetText = tweet.full_text || tweet.text || ''
		let author = strings.defaults.unknownAuthor
		if (tweet.author) {
			const beforeDot = tweet.author.split('·')[0]
			author = beforeDot.trim()
		} else if (tweet.user?.screen_name) {
			author = tweet.user.screen_name
		} else if (tweet.user?.name) {
			author = tweet.user.name
		}

		setEditingBookmark({
			id: Math.random().toString(36).substr(2, 9),
			title: tweetText.length > 80 ? tweetText.substring(0, 77) + '...' : tweetText,
			description: tweetText,
			author: author,
			categories: [categories[0] || strings.defaults.uncategorized],
			externalLinks:
				tweet.entities?.urls
					?.map((u: any) => u.expanded_url)
					.filter((url: string) => !url.includes('twitter.com') && !url.includes('x.com')) || [],
			originalLink: `https://twitter.com/i/web/status/${tweet.id_str || tweet.id}`,
			createdAt: Date.now(),
		})
		setNewBookmarkMode(true)
	}

	const handleCarouselSave = () => {
		if (!editingBookmark) return

		// Save the current edited bookmark
		setEditedTweetsInCarousel((prev) => [...prev, editingBookmark])

		// Remove current tweet from carousel
		const updatedCarousel = carouselTweets.filter((_, idx) => idx !== carouselIndex)
		setCarouselTweets(updatedCarousel)

		// If there are more tweets, prepare the next one (stay at same index)
		if (updatedCarousel.length > 0) {
			const nextIndex = Math.min(carouselIndex, updatedCarousel.length - 1)
			setCarouselIndex(nextIndex)
			prepareCarouselTweetForEdit(updatedCarousel[nextIndex])
		} else {
			// No more tweets, close carousel
			setIsCarouselModalOpen(false)
			setEditingBookmark(null)
			setNewBookmarkMode(false)
			// Return to review modal
			setIsReviewModalOpen(true)
		}
	}

	const handleCarouselNext = () => {
		if (carouselIndex < carouselTweets.length - 1) {
			const nextIndex = carouselIndex + 1
			setCarouselIndex(nextIndex)
			prepareCarouselTweetForEdit(carouselTweets[nextIndex])
		}
	}

	const handleCarouselPrev = () => {
		if (carouselIndex > 0) {
			const prevIndex = carouselIndex - 1
			setCarouselIndex(prevIndex)
			prepareCarouselTweetForEdit(carouselTweets[prevIndex])
		}
	}

	const handleCarouselClose = () => {
		setIsCarouselModalOpen(false)
		setEditingBookmark(null)
		setNewBookmarkMode(false)
		// Return to review modal
		setIsReviewModalOpen(true)
	}

	const handleFinalAccept = () => {
		// Add all edited tweets to bookmarks
		const updatedBookmarks = [...bookmarks, ...editedTweetsInCarousel]
		setBookmarks(updatedBookmarks)
		storage.saveBookmarks(updatedBookmarks)

		// Remove edited tweets from rejectedTweets
		const editedIds = new Set(editedTweetsInCarousel.map((b) => b.originalLink.split('/').pop()))
		const remainingRejected = rejectedTweets.filter((t) => {
			const id = t.id_str || t.id
			return !editedIds.has(String(id))
		})
		setRejectedTweets(remainingRejected)

		// Clear review states
		setIsReviewModalOpen(false)
		setSelectedTweetsForReview(new Set())
		setEditedTweetsInCarousel([])
		setHasPendingReview(false)

		// Show success message
		setResultModal({
			title: strings.modal.successTitle,
			message: `S'han afegit ${editedTweetsInCarousel.length} tweet${editedTweetsInCarousel.length !== 1 ? 's' : ''} revisats.`,
		})
	}

	const openEditModalForReviewTweet = (tweet: TweetRaw) => {
		const tweetText = tweet.full_text || tweet.text || ''
		let author = strings.defaults.unknownAuthor
		if (tweet.author) {
			const beforeDot = tweet.author.split('·')[0]
			author = beforeDot.trim()
		} else if (tweet.user?.screen_name) {
			author = tweet.user.screen_name
		} else if (tweet.user?.name) {
			author = tweet.user.name
		}

		setEditingBookmark({
			id: Math.random().toString(36).substr(2, 9),
			title: tweetText.length > 80 ? tweetText.substring(0, 77) + '...' : tweetText,
			description: tweetText,
			author: author,
			categories: [categories[0] || strings.defaults.uncategorized],
			externalLinks:
				tweet.entities?.urls
					?.map((u: any) => u.expanded_url)
					.filter((url: string) => !url.includes('twitter.com') && !url.includes('x.com')) || [],
			originalLink: `https://twitter.com/i/web/status/${tweet.id_str || tweet.id}`,
			createdAt: Date.now(),
		})
		setNewBookmarkMode(true)
		setIsEditModalOpen(true)
	}

	const handleReviewTweetSave = () => {
		if (!editingBookmark) return

		// Save the current tweet
		setBookmarks((prev) => [editingBookmark, ...prev])

		// Remove from rejectedTweets
		const currentTweetId = tweetsToEdit[currentEditIndex].id_str || tweetsToEdit[currentEditIndex].id
		setRejectedTweets((prev) =>
			prev.filter((t) => {
				const id = t.id_str || t.id
				return String(id) !== String(currentTweetId)
			})
		)

		// Check if there are more tweets to edit
		if (currentEditIndex < tweetsToEdit.length - 1) {
			setCurrentEditIndex((prev) => prev + 1)
			openEditModalForReviewTweet(tweetsToEdit[currentEditIndex + 1])
		} else {
			// Finished editing all selected tweets
			setIsEditModalOpen(false)
			setEditingBookmark(null)
			setTweetsToEdit([])
			setCurrentEditIndex(0)
			setSelectedTweetsForReview(new Set())

			// Show final result modal
			setResultModal({
				title: strings.modal.successTitle,
				message: strings.alerts.importResult
					.replace('{0}', String(bookmarks.length + tweetsToEdit.length))
					.replace('{1}', '0')
					.replace('{2}', String(rejectedTweets.length - tweetsToEdit.length)),
			})
		}
	}

	const handleCategoryAdd = () => {
		if (newCategoryName && !categories.includes(newCategoryName)) {
			const next = [...categories, newCategoryName]
			setCategories(next)
			setNewCategoryName('')
		}
	}

	const handleCategoryDelete = (cat: string) => {
		setConfirmModal({
			isOpen: true,
			title: strings.modal.deleteTitle,
			message: strings.alerts.confirmDeleteCategory.replace('{0}', cat),
			isDanger: true,
			onConfirm: () => {
				const nextCats = categories.filter((c) => c !== cat)
				setCategories(nextCats)
				setBookmarks((prev) => {
					const nextBooks = prev.map((b) =>
						b.categories.includes(cat)
						? { ...b, categories: b.categories.filter(c => c !== cat).length > 0
							? b.categories.filter(c => c !== cat)
							: [strings.defaults.uncategorized] }
						: b
					)
					return nextBooks
				})
				setConfirmModal(null)
			},
		})
	}

	// Drag and Drop handlers for categories
	const handleCategoryDragStart = (index: number) => {
		setDraggedCategoryIndex(index)
	}

	const handleCategoryDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault()
		setDragOverCategoryIndex(index)
	}

	const handleCategoryDrop = (e: React.DragEvent, dropIndex: number) => {
		e.preventDefault()

		if (draggedCategoryIndex === null || draggedCategoryIndex === dropIndex) {
			setDraggedCategoryIndex(null)
			setDragOverCategoryIndex(null)
			return
		}

		// Reorder categories
		const newCategories = [...categories]
		const draggedCategory = newCategories[draggedCategoryIndex]
		newCategories.splice(draggedCategoryIndex, 1)
		newCategories.splice(dropIndex, 0, draggedCategory)

		setCategories(newCategories)
		storage.saveCategories(newCategories)

		setDraggedCategoryIndex(null)
		setDragOverCategoryIndex(null)
	}

	const handleCategoryDragEnd = () => {
		setDraggedCategoryIndex(null)
		setDragOverCategoryIndex(null)
	}

	// Search Function
	const handleSearch = (query: string) => {
		if (!query.trim()) {
			setSearchResults([])
			return
		}

		const lowerQuery = query.toLowerCase().trim()
		const results = bookmarks.filter((bookmark) => {
			const titleMatch = bookmark.title.toLowerCase().includes(lowerQuery)
			const descriptionMatch = bookmark.description.toLowerCase().includes(lowerQuery)
			const authorMatch = bookmark.author.toLowerCase().includes(lowerQuery)

			return titleMatch || descriptionMatch || authorMatch
		})

		setSearchResults(results)

		// Update URL with search param
		const url = new URL(window.location.href)
		url.searchParams.set('search', query)
		window.history.pushState({}, '', url)

		// Close search modal
		setIsSearchModalOpen(false)
	}

	// Group AND Sort by Date (Newest to Oldest)
	const groupedBookmarks = useMemo(() => {
		const groups: Record<string, Bookmark[]> = {}
		categories.forEach((c) => (groups[c] = []))
		if (!groups[strings.defaults.uncategorized]) groups[strings.defaults.uncategorized] = []

		bookmarks.forEach((b) => {
			// Add bookmark to ALL its categories
			const cats = b.categories || ['Altres']  // Fallback for safety
			cats.forEach((cat) => {
				if (groups[cat]) {
					groups[cat].push(b)
				} else {
					const uncategorized = strings.defaults.uncategorized
					if (!groups[uncategorized]) groups[uncategorized] = []
					groups[uncategorized].push(b)
				}
			})
		})

		// Sort each group by createdAt DESC
		Object.keys(groups).forEach((key) => {
			groups[key].sort((a, b) => b.createdAt - a.createdAt)
		})

		return groups
	}, [bookmarks, categories])

	const scrollToCategory = (cat: string) => {
		const element = document.getElementById(`category-${cat}`)
		if (element) {
			const offset = 80
			const bodyRect = document.body.getBoundingClientRect().top
			const elementRect = element.getBoundingClientRect().top
			const elementPosition = elementRect - bodyRect
			const offsetPosition = elementPosition - offset
			window.scrollTo({
				top: offsetPosition,
				behavior: 'smooth',
			})
			setIsMobileMenuOpen(false) // Close mobile menu if open
		}
	}

	return (
		<div className='min-h-screen bg-[#f0f0f0] text-black pb-20'>
			{/* Main Header (Static) */}
			<header className='bg-white border-b-4 border-black p-6 shadow-md'>
				<div className='max-w-[1600px] mx-auto flex flex-col xl:flex-row justify-between items-center gap-6'>
					<div className='flex items-center gap-4'>
						<h1 className='text-4xl font-black uppercase tracking-tighter bg-black text-white px-3 py-1 inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'>
							{strings.app.title}
						</h1>
						<div className='hidden md:block h-8 w-0.5 bg-black/20'></div>
						<p className='hidden md:block font-mono text-sm text-gray-600 font-bold'>
							{strings.app.total}: {bookmarks.length} | {strings.app.catLabel}: {categories.length}
						</p>
					</div>

					<div className='flex flex-wrap gap-3 items-center justify-left'>
						<label className='cursor-pointer'>
							<input
								type='file'
								accept='.json'
								onChange={handleFileUpload}
								className='hidden'
								disabled={isLoading}
							/>
							<div
								className={`font-mono font-bold text-sm px-5 py-2.5 border-2 border-black flex items-center gap-2 transition-all bg-yellow-400 shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
									isLoading ? 'cursor-not-allowed opacity-50' : ''
								}`}
							>
								<Upload size={18} /> {strings.app.importJson}
							</div>
						</label>

						{rejectedTweets.length > 0 && !isLoading && (
							<Button
								onClick={handleDownloadRejected}
								variant='secondary'
								className='py-2.5 px-4'
								icon={<FileDown size={18} />}
							>
								{strings.app.downloadRejected.replace('{0}', String(rejectedTweets.length))}
							</Button>
						)}

						<div className='h-8 w-px bg-gray-300 mx-1'></div>

						<Button
							onClick={handleExport}
							variant='secondary'
							className='py-2.5 px-4'
							icon={<Download size={18} />}
						>
							{strings.app.exportData}
						</Button>

						<Button
							onClick={openNewBookmarkModal}
							variant='secondary'
							className='py-2.5 px-4'
							icon={<Plus size={18} />}
						>
							{strings.app.addManual}
						</Button>

						<Button
							onClick={() => setIsCategoryModalOpen(true)}
							variant='secondary'
							className='py-2.5 px-4'
							icon={<Settings size={18} />}
						>
							{strings.app.categories}
						</Button>

						{hasPendingReview && rejectedTweets.length > 0 && (
							<Button
								onClick={() => setIsReviewModalOpen(true)}
								variant='primary'
								className='py-2.5 px-4 bg-orange-500 border-orange-500 hover:bg-orange-600'
								icon={<Edit2 size={18} />}
							>
								Revisar Pendents ({rejectedTweets.length})
							</Button>
						)}

						<Button
							onClick={handleResetData}
							variant='danger'
							className='py-2.5 px-4 reset'
							icon={<Trash2 size={18} />}
						>
							RESET
						</Button>
					</div>
				</div>
			</header>

			{/* Desktop Sticky Category Nav (Hidden on Mobile) */}
			{bookmarks.length > 0 && (
				<div className='hidden md:block sticky top-0 z-40 bg-[#f0f0f0]/95 backdrop-blur border-b-2 border-black py-3 px-6 shadow-sm'>
					<div className='max-w-[1600px] mx-auto flex flex-wrap items-center gap-3'>
						<span className='font-mono font-bold uppercase text-xs text-gray-500 whitespace-nowrap'>
							{strings.app.jumpTo}
						</span>
						<button
							onClick={() => setIsSearchModalOpen(true)}
							className='px-3 py-1 bg-yellow-400 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]'
							title='Cercar'
						>
							<Search size={14} />
							CERCAR
						</button>
						<div className='flex flex-wrap gap-2'>
							{categories.map((cat) => {
								const count = groupedBookmarks[cat]?.length || 0
								if (count === 0) return null
								return (
									<button
										key={cat}
										onClick={() => scrollToCategory(cat)}
										className='px-3 py-1 bg-white border border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc]'
									>
										{cat}
										<span className='bg-yellow-400 text-black px-1.5 py-0.5 text-[10px] border border-black'>
											{count}
										</span>
									</button>
								)
							})}
						</div>
					</div>
				</div>
			)}

			{/* Mobile Fixed Burger Menu (Visible only on Mobile) */}
			<div className='md:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50'>
				<button
					onClick={() => setIsMobileMenuOpen(true)}
					className='bg-yellow-400 border-2 border-black px-4 py-2 font-bold font-mono text-sm shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 active:translate-y-[2px] active:shadow-none'
				>
					<Menu size={18} /> CATEGORIES
				</button>
			</div>

			{/* Mobile Menu Modal */}
			{isMobileMenuOpen && (
				<div className='fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'>
					<div className='bg-white border-4 border-black w-full max-w-sm max-h-[80vh] overflow-y-auto flex flex-col shadow-[8px_8px_0px_0px_#fff]'>
						<div className='p-4 border-b-2 border-black bg-yellow-400 flex justify-between items-center'>
							<h2 className='font-bold text-xl uppercase font-mono'>{strings.app.categories}</h2>
							<button onClick={() => setIsMobileMenuOpen(false)}>
								<X size={24} />
							</button>
						</div>
						<div className='p-4 flex flex-col gap-3'>
							<button
								onClick={() => {
									setIsMobileMenuOpen(false)
									setIsSearchModalOpen(true)
								}}
								className='text-left font-bold font-mono text-lg border-2 border-black p-3 bg-yellow-400 hover:bg-black hover:text-white transition-all flex justify-between items-center shadow-[4px_4px_0px_0px_#000]'
							>
								<span className='flex items-center gap-2'>
									<Search size={18} />
									CERCAR
								</span>
							</button>
							{categories.map((cat) => {
								const count = groupedBookmarks[cat]?.length || 0
								if (count === 0) return null
								return (
									<button
										key={cat}
										onClick={() => scrollToCategory(cat)}
										className='text-left font-bold font-mono text-lg border-2 border-black p-3 hover:bg-black hover:text-white transition-all flex justify-between items-center bg-white shadow-[4px_4px_0px_0px_#ccc]'
									>
										{cat}
										<span className='bg-yellow-300 text-black text-xs px-2 py-1 border border-black'>
											{count}
										</span>
									</button>
								)
							})}
						</div>
					</div>
				</div>
			)}

			{/* Main Content */}
			<main className='max-w-[1600px] mx-auto p-6 flex flex-col gap-12 mt-4 md:mt-4 pt-16 md:pt-4'>
				{bookmarks.length === 0 && !isLoading && (
					<div className='text-center py-32 border-4 border-dashed border-gray-300 m-8 bg-gray-50 rounded-lg'>
						<div className='flex justify-center mb-6 text-gray-300'>
							<Hash size={64} />
						</div>
						<h2 className='text-3xl font-bold text-gray-400 mb-4 font-mono'>{strings.app.noDataTitle}</h2>
						<p className='text-gray-500 max-w-md mx-auto font-mono'>{strings.app.noDataDesc}</p>
					</div>
				)}

				{/* Search Results View */}
				{searchQuery && (
					<div>
						<div className='flex items-center gap-4 mb-6 flex-wrap'>
							<h2 className='text-3xl font-black uppercase bg-yellow-400 text-black px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] border-2 border-black'>
								Resultats: "{searchQuery}"
							</h2>
							<span className='font-mono font-bold text-xl text-gray-500'>
								{searchResults.length} resultat{searchResults.length !== 1 ? 's' : ''}
							</span>
							<button
								onClick={() => {
									setSearchQuery('')
									setSearchResults([])
									window.history.pushState({}, '', window.location.pathname)
								}}
								className='font-mono font-bold text-sm px-4 py-2 border-2 border-black bg-white hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]'
							>
								✕ Netejar cerca
							</button>
						</div>

						{searchResults.length === 0 ? (
							<div className='text-center py-20'>
								<p className='font-mono text-xl text-gray-600'>
									No s'han trobat resultats per "{searchQuery}"
								</p>
							</div>
						) : (
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
								{searchResults.map((bookmark) => (
									<BookmarkCard
										key={bookmark.id}
										bookmark={bookmark}
										onEdit={openEditModal}
										onDelete={requestDelete}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* Categories View (only show when no search) */}
				{!searchQuery &&
					categories.map((category) => {
						const items = groupedBookmarks[category]
						if (!items || items.length === 0) return null

						return (
							<div key={category} id={`category-${category}`} className='scroll-mt-48'>
								<div className='flex items-center gap-4 mb-6'>
									<h2 className='text-3xl font-black uppercase bg-black text-white px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'>
										{category}
									</h2>
									<span className='font-mono font-bold text-xl text-gray-500'>{items.length}</span>
									<div className='h-1 flex-grow bg-black'></div>
								</div>

								<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
									{items.map((bookmark) => (
										<BookmarkCard
											key={bookmark.id}
											bookmark={bookmark}
											onEdit={openEditModal}
											onDelete={requestDelete}
										/>
									))}
								</div>
							</div>
						)
					})}
			</main>

			{/* Log Console Modal (Only visible when loading or explicitly open) */}
			<Modal
				isOpen={isLoading || (logs.length > 0 && !isLoading && !resultModal)}
				onClose={() => {
					if (!isLoading) setLogs([])
				}}
				title={strings.logs.title}
			>
				<div className='flex flex-col gap-4'>
					{isLoading && (
						<div className='bg-yellow-50 border-2 border-black p-4 flex items-center justify-between'>
							<div className='flex items-center gap-3'>
								<div className='animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full'></div>
								<span className='font-bold font-mono text-sm'>
									{strings.app.processingProgress.replace(
										'{0}',
										String(Math.round((progress.current / (progress.total || 1)) * 100))
									)}
								</span>
							</div>
							<button
								onClick={handleStop}
								className='bg-red-500 text-white px-3 py-1 border-2 border-black font-bold text-xs hover:bg-red-600 shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none'
							>
								{strings.app.stop}
							</button>
						</div>
					)}

					<div className='bg-black border-2 border-gray-700 h-64 overflow-y-auto p-4 font-mono text-xs flex flex-col gap-1 shadow-inner'>
						{logs.map((log, i) => (
							<div
								key={i}
								className={`flex gap-2 ${
									log.type === 'error'
										? 'text-red-500'
										: log.type === 'success'
										? 'text-green-400'
										: log.type === 'warning'
										? 'text-yellow-400'
										: 'text-gray-300'
								}`}
							>
								<span className='opacity-50'>[{log.timestamp}]</span>
								<span>{log.message}</span>
							</div>
						))}
						<div ref={logsEndRef} />
					</div>

					{!isLoading && (
						<div className='flex justify-end'>
							<Button onClick={() => setLogs([])}>{strings.modal.btnCloseConsole}</Button>
						</div>
					)}
				</div>
			</Modal>

			{/* Result Modal (Replaces Alerts) */}
			<Modal isOpen={!!resultModal} onClose={closeResultModal} title={resultModal?.title || ''}>
				<div className='mb-6'>
					<p className='font-mono text-base'>{resultModal?.message}</p>
				</div>
				<div className='flex justify-end'>
					<Button onClick={closeResultModal}>{strings.modal.btnOk}</Button>
				</div>
			</Modal>

			{/* Generic Confirmation Modal (Replaces confirm() dialogs) */}
			{confirmModal && (
				<Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(null)} title={confirmModal.title}>
					<div className='mb-8'>
						<p className='font-mono text-base whitespace-pre-wrap'>{confirmModal.message}</p>
					</div>
					<div className='flex justify-end gap-3'>
						<Button variant='secondary' onClick={() => setConfirmModal(null)}>
							{strings.modal.btnCancel}
						</Button>
						<Button variant={confirmModal.isDanger ? 'danger' : 'primary'} onClick={confirmModal.onConfirm}>
							{strings.modal.btnOk}
						</Button>
					</div>
				</Modal>
			)}

			{/* Edit/Create Modal */}
			<Modal
				isOpen={isEditModalOpen}
				onClose={() => setIsEditModalOpen(false)}
				title={newBookmarkMode ? strings.modal.createTitle : strings.modal.editTitle}
			>
				{editingBookmark && (
					<div className='space-y-4'>
						<div>
							<Label>{strings.modal.labelTitle}</Label>
							<Input
								value={editingBookmark.title}
								onChange={(e) => setEditingBookmark({ ...editingBookmark, title: e.target.value })}
							/>
						</div>

						<div>
							<Label>{strings.modal.labelCategory}</Label>
							<div className='space-y-2 border-2 border-black p-3 bg-gray-50 max-h-64 overflow-y-auto'>
								{categories.map((cat) => (
									<label key={cat} className='flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1'>
										<input
											type='checkbox'
											checked={editingBookmark.categories.includes(cat)}
											onChange={(e) => {
												setEditingBookmark({
													...editingBookmark,
													categories: toggleCategory(cat, e.target.checked, editingBookmark.categories)
												})
											}}
											className='w-4 h-4 border-2 border-black'
										/>
										<span className='font-mono'>{cat}</span>
									</label>
								))}
							</div>
						</div>

						<div>
							<Label>{strings.modal.labelDescription}</Label>
							<TextArea
								rows={6}
								value={editingBookmark.description}
								onChange={(e) =>
									setEditingBookmark({ ...editingBookmark, description: e.target.value })
								}
							/>
						</div>

						<div>
							<Label>{strings.modal.labelAuthor}</Label>
							<Input
								value={editingBookmark.author || ''}
								onChange={(e) => setEditingBookmark({ ...editingBookmark, author: e.target.value })}
								placeholder='@username'
							/>
						</div>

						<div>
							<Label>{strings.modal.labelOriginalLink}</Label>
							<Input
								value={editingBookmark.originalLink}
								onChange={(e) =>
									setEditingBookmark({ ...editingBookmark, originalLink: e.target.value })
								}
							/>
						</div>

						<div>
							<Label>{strings.modal.labelExternalLinks}</Label>
							<Input
								value={editingBookmark.externalLinks.join(', ')}
								onChange={(e) =>
									setEditingBookmark({
										...editingBookmark,
										externalLinks: e.target.value
											.split(',')
											.map((s) => s.trim())
											.filter((s) => s),
									})
								}
								placeholder={strings.modal.placeholderExternalLinks}
							/>
						</div>

						<div className='pt-4 flex justify-end gap-2'>
							<Button variant='secondary' onClick={() => setIsEditModalOpen(false)}>
								{strings.modal.btnCancel}
							</Button>
							<Button onClick={tweetsToEdit.length > 0 ? handleReviewTweetSave : saveBookmark}>
								{tweetsToEdit.length > 0
									? `${strings.modal.btnSave} (${currentEditIndex + 1}/${tweetsToEdit.length})`
									: strings.modal.btnSave}
							</Button>
						</div>
					</div>
				)}
			</Modal>

			{/* Categories Modal */}
			<Modal
				isOpen={isCategoryModalOpen}
				onClose={() => setIsCategoryModalOpen(false)}
				title={strings.modal.manageCategories}
			>
				<div className='mb-6 flex gap-2'>
					<Input
						value={newCategoryName}
						onChange={(e) => setNewCategoryName(e.target.value)}
						placeholder={strings.modal.placeholderNewCategory}
					/>
					<Button onClick={handleCategoryAdd} icon={<Plus size={16} />}>
						{strings.modal.btnAdd}
					</Button>
				</div>

				<div className='flex flex-col gap-2'>
					<p className='text-sm text-gray-600 font-mono mb-2'>
						💡 Arrossega les categories per canviar l'ordre
					</p>
					{categories.map((cat, index) => (
						<div
							key={cat}
							draggable={true}
							onDragStart={() => handleCategoryDragStart(index)}
							onDragOver={(e) => handleCategoryDragOver(e, index)}
							onDrop={(e) => handleCategoryDrop(e, index)}
							onDragEnd={handleCategoryDragEnd}
							className={`flex justify-between items-center bg-gray-50 p-3 border-2 border-black cursor-move transition-all ${
								draggedCategoryIndex === index ? 'opacity-50 scale-95' : ''
							} ${
								dragOverCategoryIndex === index && draggedCategoryIndex !== index
									? 'border-blue-500 bg-blue-50'
									: ''
							}`}
						>
							<div className='flex items-center gap-3'>
								<span className='text-gray-400 select-none'>☰</span>
								<span className='font-mono font-bold'>{cat}</span>
							</div>
							<button
								onClick={() => handleCategoryDelete(cat)}
								className='text-red-500 hover:bg-red-100 p-2 border border-transparent hover:border-red-500 transition-all'
								disabled={cat === strings.defaults.uncategorized}
							>
								<Trash2 size={16} />
							</button>
						</div>
					))}
				</div>
			</Modal>

			{/* Delete Confirmation Modal */}
			<Modal
				isOpen={deleteModalState.isOpen}
				onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
				title={strings.modal.deleteTitle}
			>
				<div className='mb-8'>
					<p className='font-mono text-lg'>{strings.alerts.confirmDelete}</p>
				</div>

				<div className='flex justify-end gap-3'>
					<Button
						variant='secondary'
						onClick={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
					>
						{strings.modal.btnCancel}
					</Button>
					<Button variant='danger' onClick={confirmDelete} icon={<Trash2 size={18} />}>
						{strings.modal.btnDelete}
					</Button>
				</div>
			</Modal>

			{/* Search Modal */}
			<Modal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} title='Cercar Bookmarks'>
				<div className='space-y-4'>
					<div>
						<Label>Cerca per títol, autor o contingut</Label>
						<Input
							type='text'
							placeholder='Introdueix el text a cercar...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									handleSearch(searchQuery)
								}
							}}
							autoFocus
						/>
					</div>

					<div className='flex justify-end gap-3'>
						<Button variant='secondary' onClick={() => setIsSearchModalOpen(false)}>
							{strings.modal.btnCancel}
						</Button>
						<Button
							onClick={() => handleSearch(searchQuery)}
							disabled={!searchQuery.trim()}
							icon={<Search size={16} />}
						>
							Cercar
						</Button>
					</div>
				</div>
			</Modal>

			{/* Review Rejected Tweets Modal */}
			<Modal
				isOpen={isReviewModalOpen}
				onClose={() => {
					setIsReviewModalOpen(false)
					setSelectedTweetsForReview(new Set())
					// Show result modal when closing without reviewing
					setResultModal({
						title: strings.modal.successTitle,
						message: strings.alerts.importResult
							.replace('{0}', String(bookmarks.length))
							.replace('{1}', '0')
							.replace('{2}', String(rejectedTweets.length)),
					})
				}}
				title='Revisar Tweets Descartats'
			>
				<div className='mb-4'>
					<p className='font-mono text-sm mb-4'>
						Gemini ha descartat {rejectedTweets.length} tweet{rejectedTweets.length !== 1 ? 's' : ''} perquè
						no estan relacionats amb IA o han fallat el processament. Selecciona els que vulguis afegir
						igualment:
					</p>
				</div>

				<div className='max-h-96 overflow-y-auto border-2 border-black p-4 mb-4'>
					{rejectedTweets.map((tweet) => {
						const tweetId = tweet.id_str || tweet.id || ''
						const tweetText = tweet.full_text || tweet.text || ''
						const isSelected = selectedTweetsForReview.has(String(tweetId))

						return (
							<div
								key={tweetId}
								className='mb-3 p-3 border-2 border-gray-300 hover:border-black transition-colors'
							>
								<label className='flex items-start gap-3 cursor-pointer'>
									<input
										type='checkbox'
										checked={isSelected}
										onChange={() => toggleTweetSelection(String(tweetId))}
										className='mt-1 w-5 h-5 cursor-pointer'
									/>
									<div className='flex-1'>
										<p className='font-mono text-sm whitespace-pre-wrap break-words'>
											{tweetText.substring(0, 200)}
											{tweetText.length > 200 ? '...' : ''}
										</p>
										<div className='flex items-center gap-3 mt-2'>
											{tweet.author && (
												<p className='text-xs text-gray-500'>{tweet.author.split('·')[0]}</p>
											)}
											<a
												href={`https://twitter.com/i/web/status/${tweetId}`}
												target='_blank'
												rel='noopener noreferrer'
												onClick={(e) => e.stopPropagation()}
												className='text-xs text-blue-600 hover:underline flex items-center gap-1'
											>
												<Twitter size={12} /> Veure original
											</a>
										</div>
									</div>
								</label>
							</div>
						)
					})}
				</div>

				<div className='flex justify-between gap-3'>
					<div className='flex gap-3'>
						<Button
							variant='secondary'
							onClick={() => {
								// Revisió parcial: manté hasPendingReview true per poder tornar-hi
								setIsReviewModalOpen(false)
								// NO netegem selectedTweetsForReview ni editedTweetsInCarousel
							}}
						>
							Revisió parcial
						</Button>

						<Button
							variant='danger'
							onClick={() => {
								// Revisió finalitzada: neteja tot i tanca definitivament
								setIsReviewModalOpen(false)
								setSelectedTweetsForReview(new Set())
								setHasPendingReview(false)
								setEditedTweetsInCarousel([])
								setRejectedTweets([])
								setResultModal({
									title: strings.modal.successTitle,
									message: strings.alerts.importResult
										.replace('{0}', String(bookmarks.length))
										.replace('{1}', '0')
										.replace('{2}', '0'),
								})
							}}
						>
							Revisió finalitzada
						</Button>
					</div>

					<div className='flex gap-3'>
						{editedTweetsInCarousel.length > 0 && (
							<Button variant='primary' onClick={handleFinalAccept}>
								Acceptar ({editedTweetsInCarousel.length} editats)
							</Button>
						)}
						<Button onClick={handleConfirmReview} disabled={selectedTweetsForReview.size === 0}>
							Revisar Seleccionats ({selectedTweetsForReview.size})
						</Button>
					</div>
				</div>
			</Modal>

			{/* Carousel Modal for editing tweets one by one */}
			{isCarouselModalOpen && editingBookmark && (
				<Modal isOpen={isCarouselModalOpen} onClose={handleCarouselClose} title='Editar Tweets'>
					<div className='space-y-4'>
						{/* Counter */}
						<div className='text-center font-mono text-sm text-gray-600 font-bold'>
							{carouselIndex + 1} / {carouselTweets.length + editedTweetsInCarousel.length}
						</div>

						{/* Edit form */}
						<div className='space-y-4'>
							<div>
								<Label>{strings.modal.labelTitle}</Label>
								<Input
									value={editingBookmark.title}
									onChange={(e) => setEditingBookmark({ ...editingBookmark, title: e.target.value })}
								/>
							</div>

							<div>
								<Label>{strings.modal.labelCategory}</Label>
								<div className='space-y-2 border-2 border-black p-3 bg-gray-50 max-h-64 overflow-y-auto'>
									{categories.map((cat) => (
										<label key={cat} className='flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1'>
											<input
												type='checkbox'
												checked={editingBookmark.categories.includes(cat)}
												onChange={(e) => {
													setEditingBookmark({
														...editingBookmark,
														categories: toggleCategory(cat, e.target.checked, editingBookmark.categories)
													})
												}}
												className='w-4 h-4 border-2 border-black'
											/>
											<span className='font-mono'>{cat}</span>
										</label>
									))}
								</div>
							</div>

							<div>
								<Label>{strings.modal.labelDescription}</Label>
								<TextArea
									rows={6}
									value={editingBookmark.description}
									onChange={(e) => setEditingBookmark({ ...editingBookmark, description: e.target.value })}
								/>
							</div>

							<div>
								<Label>{strings.modal.labelAuthor}</Label>
								<Input
									value={editingBookmark.author || ''}
									onChange={(e) => setEditingBookmark({ ...editingBookmark, author: e.target.value })}
									placeholder='@username'
								/>
							</div>

							<div>
								<Label>{strings.modal.labelExternalLinks}</Label>
								<Input
									value={editingBookmark.externalLinks.join(', ')}
									onChange={(e) =>
										setEditingBookmark({
											...editingBookmark,
											externalLinks: e.target.value
												.split(',')
												.map((s) => s.trim())
												.filter((s) => s),
										})
									}
									placeholder={strings.modal.placeholderExternalLinks}
								/>
							</div>
						</div>

						{/* Navigation buttons */}
						<div className='flex justify-between items-center pt-4 border-t-2 border-black'>
							<Button
								variant='secondary'
								onClick={handleCarouselPrev}
								disabled={carouselIndex === 0}
								className='px-3 py-2'
							>
								← Anterior
							</Button>

							<Button onClick={handleCarouselSave} variant='primary'>
								Guardar i Seguir
							</Button>

							<Button
								variant='secondary'
								onClick={handleCarouselNext}
								disabled={carouselIndex === carouselTweets.length - 1}
								className='px-3 py-2'
							>
								Següent →
							</Button>
						</div>
					</div>
				</Modal>
			)}

			{/* Trial Countdown Widget */}
			<TrialCountdown />
		</div>
	)
}
