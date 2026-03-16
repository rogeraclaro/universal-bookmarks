# Guia d'Implementació: Feature "Destacar" amb Categoria Virtual

## Context

Aquesta guia documenta la implementació d'una feature de "destacar" cards visuals en una app de gestió de bookmarks (React + TypeScript + Tailwind CSS). L'app té arquitectura neobrutalist, storage via API REST en VPS (o localStorage com a fallback), i les dades persistides inclouen un array de `bookmarks` i un array de `categories`.

**Data d'implementació:** 2026-03-16
**App:** AI Bookmark Manager
**Prompt original de l'usuari:**
> Afegir botó "Destacar"/"No destacar" a les cards per marcar-les visualment amb fons groc. Persistència multi-dispositiu. Categoria virtual "DESTACAT" sempre l'última a la navegació. Documentar el procés per reutilitzar-lo en una altra app similar.

---

## Requeriments

1. Botó toggle "Destacar" / "No destacar" a cada card, alineat a la dreta, a la mateixa alçada que el botó "Veure Tuit Original"
2. Quan `highlighted = true`: fons de la card `rgba(250, 204, 21, 0.5)` (groc semitransparent)
3. Persistència via el sistema d'storage existent (API o localStorage)
4. Categoria virtual "DESTACAT" — apareix sempre l'última, tant a la nav com al contingut
5. La categoria "DESTACAT" és **virtual/computada** (no es guarda a l'array de categories)

---

## Fitxers Modificats

### 1. `src/types.ts`

**Canvi:** Afegir el camp `highlighted` opcional a la interfície `Bookmark`.

```typescript
export interface Bookmark {
  id: string;
  title: string;
  description: string;
  author: string;
  originalLink: string;
  externalLinks: string[];
  categories: string[];
  createdAt: number;
  highlighted?: boolean;  // <-- AFEGIT
}
```

**Per què `optional`?** Per compatibilitat amb dades existents: bookmarks antics no tindran el camp i es tractaran com `false`.

---

### 2. `src/translations.ts`

**Canvi:** Afegir strings per al botó i la categoria.

```typescript
app: {
  // ... strings existents ...
  highlight: "Destacar",
  unhighlight: "No destacar",
  highlightedCategory: "DESTACAT",
}
```

---

### 3. `src/App.tsx` — BookmarkCard Component

**Canvi 1:** Afegir props `onToggleHighlight` i modificar el fons condicionalment.

**Signatura del component actualitzada:**
```tsx
const BookmarkCard: React.FC<{
  bookmark: Bookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string, originalId: string) => void
  onToggleHighlight: (id: string) => void  // <-- AFEGIT
}> = ({ bookmark, onEdit, onDelete, onToggleHighlight }) => {
```

**Fons condicional** (inline style per evitar problemes amb Tailwind JIT i valors rgba personalitzats):
```tsx
<div
  className='border-2 border-black p-5 h-full flex flex-col shadow-[...] hover:... transition-all duration-200'
  style={{ backgroundColor: bookmark.highlighted ? 'rgba(250, 204, 21, 0.5)' : 'white' }}
>
```

**Botó toggle** (dins del div `mt-auto`, en una fila amb "Veure Tuit Original"):
```tsx
<div className='mt-auto pt-4 border-t-2 border-black/10 flex flex-col gap-3'>
  <div className='flex items-center justify-between'>
    <a href={bookmark.originalLink} ...>
      <Twitter size={14} /> {strings.app.viewOriginal}
    </a>
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggleHighlight(bookmark.id)
      }}
      className={`text-xs font-bold uppercase px-2 py-1 border border-black transition-colors ${
        bookmark.highlighted
          ? 'bg-yellow-400 hover:bg-white'
          : 'bg-white hover:bg-yellow-400'
      }`}
    >
      {bookmark.highlighted ? strings.app.unhighlight : strings.app.highlight}
    </button>
  </div>
  {/* external links ... */}
</div>
```

---

### 4. `src/App.tsx` — Handler `handleToggleHighlight`

**Afegit a l'App component:**
```tsx
const handleToggleHighlight = (id: string) => {
  setBookmarks((prev) =>
    prev.map((b) => (b.id === id ? { ...b, highlighted: !b.highlighted } : b))
  )
}
```

La persistència és automàtica gràcies a l'`useEffect` existent:
```tsx
useEffect(() => {
  if (bookmarks.length > 0) storage.saveBookmarks(bookmarks)
}, [bookmarks])
```

---

### 5. `src/App.tsx` — Variable Calculada `highlightedBookmarks`

```tsx
const highlightedBookmarks = useMemo(() => {
  return bookmarks.filter((b) => b.highlighted).sort((a, b) => b.createdAt - a.createdAt)
}, [bookmarks])
```

---

### 6. `src/App.tsx` — Nav Desktop

**Canvi:** Afegir botó "DESTACAT" després del `.map(categories)`, sempre l'últim, condicionalment si n'hi ha:

```tsx
{/* Categories existents */}
{categories.map((cat) => { ... })}

{/* DESTACAT virtual — sempre l'últim */}
{highlightedBookmarks.length > 0 && (
  <button
    onClick={() => scrollToCategory('DESTACAT')}
    className='px-3 py-1 bg-yellow-400 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]'
  >
    ★ {strings.app.highlightedCategory}
    <span className='bg-black text-yellow-400 px-1.5 py-0.5 text-[10px] border border-black'>
      {highlightedBookmarks.length}
    </span>
  </button>
)}
```

---

### 7. `src/App.tsx` — Nav Mòbil

Mateix patró que el nav desktop, afegit al final del `.map(categories)` dins del menú mòbil.

---

### 8. `src/App.tsx` — Secció "DESTACAT" al Contingut Principal

**Afegit DESPRÉS del `.map(categories)`, dins del bloc `{!searchQuery && ...}`:**

```tsx
{/* Secció DESTACAT — sempre l'última */}
{!searchQuery && highlightedBookmarks.length > 0 && (
  <div id='category-DESTACAT' className='scroll-mt-48'>
    <div className='flex items-center gap-4 mb-6'>
      <h2 className='text-3xl font-black uppercase bg-yellow-400 text-black px-4 py-2 inline-block border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'>
        ★ {strings.app.highlightedCategory}
      </h2>
      <span className='font-mono font-bold text-xl text-gray-500'>{highlightedBookmarks.length}</span>
      <div className='h-1 flex-grow bg-yellow-400 border border-black'></div>
    </div>
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
      {highlightedBookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={openEditModal}
          onDelete={requestDelete}
          onToggleHighlight={handleToggleHighlight}
        />
      ))}
    </div>
  </div>
)}
```

---

## Decisions de Disseny

| Decisió | Alternativa considerada | Raó de l'elecció |
|---|---|---|
| Categoria virtual (no al array) | Afegir "DESTACAT" a `categories[]` | Evita que l'usuari l'esborri/mogui; no contamina el sistema de categories |
| `highlighted?: boolean` a `Bookmark` | Array separat `highlightedIds[]` | Més simple, les dades viuen juntes, backup inclou l'estat |
| Inline `style` per al fons groc | Classe Tailwind dinàmica | Tailwind JIT no processa valors rgba calculats en runtime |
| Persistència via `useEffect` existent | Crida explícita a `storage.saveBookmarks` | Reutilitza el mecanisme ja provat, 0 codi extra |

---

## Com Reutilitzar en una Altra App Similar

### Prerequisits
- La interfície del bookmark ha de tenir (o se li pot afegir) un camp boolean `highlighted`
- Ha d'existir un mecanisme de save/load que gestioni l'objecte complet del bookmark

### Passos Genèrics

1. **Model:** Afegir `highlighted?: boolean` a la interfície/tipus del bookmark
2. **Handler:** `toggleHighlight(id) => setItems(prev => prev.map(b => b.id === id ? {...b, highlighted: !b.highlighted} : b))`
3. **Card/component:**
   - Fons condicional via `style={{ backgroundColor: item.highlighted ? 'rgba(250,204,21,0.5)' : 'white' }}`
   - Botó toggle amb text alternatiu
4. **Filtre:** `const highlighted = useMemo(() => items.filter(b => b.highlighted), [items])`
5. **Nav:** Afegir entrada "DESTACAT" al final de la llista de categories, condicionada a `highlighted.length > 0`
6. **Contingut:** Afegir secció "DESTACAT" al final de totes les seccions de categories

### Notes
- Si l'app usa localStorage, el canvi és persistent automàticament en guardar el bookmark actualitzat
- Si l'app usa una API, assegurar que el camp `highlighted` s'inclou al payload del PUT/PATCH
- La categoria "DESTACAT" no hauria d'aparèixer als filtres de classificació automàtica (ex. si hi ha IA que assigna categories)

---

## Nota d'implementació: Substitució de classe Tailwind per inline style

El card tenia `className='bg-white ...'`. Per aplicar el color de fons groc amb opacitat, **no** es pot simplement afegir una classe Tailwind dinàmica com `bg-[rgba(250,204,21,0.5)]` perquè:
1. Tailwind JIT genera clases CSS estàtiques; les classes calculades en runtime no funcionen
2. `bg-white` seguiria tenint prioritat CSS igual o superior

**Solució:** Eliminar `bg-white` del className i usar `style={{ backgroundColor: ... }}` condicionalment:
```tsx
className='border-2 border-black p-5 ...'  // bg-white eliminat
style={{ backgroundColor: bookmark.highlighted ? 'rgba(250, 204, 21, 0.5)' : 'white' }}
```

## Flux de Dades

```
Usuari clica "Destacar"
  → onToggleHighlight(bookmark.id)
  → setBookmarks: bookmark.highlighted togglejat
  → useEffect detecta canvi en bookmarks
  → storage.saveBookmarks(bookmarks)  [→ API o localStorage]
  → highlightedBookmarks recomputat (useMemo)
  → UI actualitzada: fons groc + text botó + secció DESTACAT
```

---

## Deploy al VPS (pas final)

### 1. Crear el fitxer `.env` local

```bash
VITE_STORAGE_API_URL=https://[domini-de-lapp]/api
VITE_STORAGE_SECRET=[clau-secreta-api]
```

**Important:** Usar **`https://`** i no `http://`. Si l'app s'accedeix per HTTPS i l'API URL és HTTP, el navegador bloqueja les peticions (Mixed Content error).

### 2. Fer el build

```bash
npm run build
```

### 3. Pujar per FTP

Pujar els fitxers generats a `dist/`:
```
dist/index.html
dist/assets/index-[hash].css
dist/assets/index-[hash].js
```

Els hashes canvien a cada build — sempre pujar els 3 fitxers junts, incloent el `index.html` que apunta als nous hashes.

### Per què cal el `.env`?

Vite compila les variables d'entorn **dins del JS** en temps de build. Sense el `.env`, `VITE_STORAGE_SECRET` és `undefined` → l'app usa localStorage (buit al navegador del servidor) en lloc de l'API → els bookmarks no carreguen.

### Errors habituals de deploy

| Error | Causa | Solució |
|---|---|---|
| Bookmarks no carreguen (app buida) | Build sense `.env` | Crear `.env` i tornar a fer build |
| Mixed Content blocked | URL de l'API amb `http://` en app HTTPS | Canviar a `https://` al `.env` i tornar a fer build |
| Pàgina en blanc / JS 404 | `index.html` vell amb hashes antics | Pujar el nou `index.html` juntament amb els assets |
