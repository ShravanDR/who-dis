# Who Dis? — Plan 1: Foundation + Pre-Game Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete pre-game experience — project scaffold, Firebase setup, GitHub Pages deploy, organizer setup flow, and player clue submission — resulting in a live URL where a game can be created and clues submitted before the quiz starts.

**Architecture:** React + Vite + TypeScript SPA deployed to GitHub Pages. Firebase RTDB holds all game state in real-time. Firebase Storage holds uploaded clue images. Cloud Functions handle game creation and assignment logic server-side. Screens are route-based (`/`, `/setup`, `/join/:code`, `/submit/:code`, `/monitor/:code`).

**Tech Stack:** React 18, Vite, TypeScript, Firebase 10 (RTDB + Storage + Functions), react-router-dom v6, react-image-crop, Tailwind CSS (via CDN in index.html — no PostCSS config needed), Google Fonts (Lora + Plus Jakarta Sans)

---

## File Map

```
who-dis/
├── .github/workflows/deploy.yml       # GitHub Pages deploy
├── functions/                         # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                   # Exports all functions
│   │   ├── createGame.ts              # Create game + circular assignment + hostSecret
│   │   └── updateClueSlot.ts          # Write clue URL to RTDB (phase guard)
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── main.tsx                       # App entry, router
│   ├── App.tsx                        # Route definitions
│   ├── firebase.ts                    # Firebase app init + exports
│   ├── types.ts                       # All shared TypeScript types
│   ├── lib/
│   │   ├── assignments.ts             # Circular assignment algorithm
│   │   ├── gameCode.ts                # 6-char code generation
│   │   └── imageUtils.ts             # Center-crop to 3:4, upload to Storage
│   ├── hooks/
│   │   ├── useGame.ts                 # RTDB listener for full game state
│   │   └── useLocalPlayer.ts         # localStorage: gameCode, memberId, hostSecret
│   ├── screens/
│   │   ├── Landing.tsx                # "/" — Join or Host CTAs
│   │   ├── Setup.tsx                  # "/setup" — add members, review assignments
│   │   ├── JoinGame.tsx               # "/join/:code" — name dropdown, enter game
│   │   ├── ClueSubmission.tsx         # "/submit/:code" — upload 3 images × 2 people
│   │   └── SubmissionMonitor.tsx      # "/monitor/:code" — progress grid, Start Quiz
│   └── components/
│       ├── ImageUploadSlot.tsx        # Single 3:4 upload slot with crop preview
│       ├── MemberAvatar.tsx           # Name + photo/emoji display
│       └── ProgressBar.tsx            # "N / M submitted" bar
├── index.html
├── vite.config.ts
├── tsconfig.json
├── firebase.json
├── .firebaserc
└── package.json
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Create the project**

```bash
cd /Users/shravankumar/Claude/who-dis
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install firebase react-router-dom react-image-crop
npm install -D @types/react @types/react-dom
```

- [ ] **Step 3: Update `index.html`** — add Google Fonts and Tailwind CDN

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Who Dis?</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              cream: '#FAF8F4',
              border: '#E8E0D4',
              muted: '#C4B9A8',
              accent: '#E8572A',
              danger: '#E63946',
            },
            fontFamily: {
              lora: ['Lora', 'serif'],
              jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
          }
        }
      }
    </script>
  </head>
  <body class="bg-cream font-jakarta text-[#1a1a1a]">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Update `vite.config.ts`** — set base path for GitHub Pages

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/who-dis/',
})
```

- [ ] **Step 5: Create `src/App.tsx`** with stub routes

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter basename="/who-dis">
      <Routes>
        <Route path="/" element={<div>Landing</div>} />
        <Route path="/setup" element={<div>Setup</div>} />
        <Route path="/join/:code" element={<div>Join</div>} />
        <Route path="/submit/:code" element={<div>Submit</div>} />
        <Route path="/monitor/:code" element={<div>Monitor</div>} />
        <Route path="/quiz/:code" element={<div>Quiz (Plan 2)</div>} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite server running at `http://localhost:5173/who-dis/`, "Landing" visible in browser.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold React + Vite + TS project with routing"
```

---

## Task 2: GitHub Pages deploy

**Files:**
- Create: `.github/workflows/deploy.yml`, `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
functions/node_modules/
functions/lib/
.env
.env.local
firebase-debug.log
# Do NOT ignore .firebaserc — it is needed for CI deploy
.superpowers/
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Create GitHub repo**

```bash
gh repo create ShravanDR/who-dis --public
git remote add origin https://github.com/ShravanDR/who-dis.git
git push -u origin main
```

- [ ] **Step 4: Enable GitHub Pages in repo settings**

Go to `https://github.com/ShravanDR/who-dis/settings/pages` → Source: **GitHub Actions**

- [ ] **Step 5: Commit and verify deploy**

```bash
git add .github/ .gitignore
git commit -m "feat: add GitHub Actions deploy to GitHub Pages"
git push
```
Expected: Actions tab shows green deploy. URL `https://shravandr.github.io/who-dis/` loads the app.

---

## Task 3: Firebase project setup

**Files:**
- Create: `src/firebase.ts`, `.env.local`, `firebase.json`, `.firebaserc`
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`

- [ ] **Step 1: Create Firebase project**

```bash
# Install Firebase CLI if not present
npm install -g firebase-tools
firebase login
firebase projects:create who-dis-game
```

- [ ] **Step 2: Init Firebase in project**

```bash
firebase init
```
Select: **Realtime Database**, **Storage**, **Functions**, **Emulators**
- Functions: TypeScript
- Emulators: Functions, Database, Storage

- [ ] **Step 3: Create `src/firebase.ts`**

```ts
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)
```

- [ ] **Step 4: Create `.env.local`** — fill in values from Firebase Console → Project Settings

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 5: Add GitHub Actions secrets**

In `https://github.com/ShravanDR/who-dis/settings/secrets/actions`, add each `VITE_FIREBASE_*` key with its value from Firebase Console.

- [ ] **Step 6: Set Firebase RTDB rules** — edit `database.rules.json`

```json
{
  "rules": {
    "games": {
      "$gameCode": {
        ".read": true,
        "clues": {
          ".write": "root.child('games').child($gameCode).child('meta/phase').val() === 'clue-submission'"
        },
        "meta": { ".write": false },
        "members": { ".write": false },
        "rounds": { ".write": false },
        "scores": { ".write": false }
      }
    }
  }
}
```

- [ ] **Step 7: Set Firebase Storage rules** — edit `storage.rules`

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /clues/{gameCode}/{allPaths=**} {
      allow read: if true;
      allow write: if true; // Scoped by path; phase enforcement via RTDB rules
    }
  }
}
```

- [ ] **Step 8: Init functions `package.json`**

```bash
cd functions
npm install firebase-admin firebase-functions uuid openai
npm install -D typescript @types/node
```

- [ ] **Step 9: Commit**

```bash
cd ..
git add src/firebase.ts firebase.json .firebaserc database.rules.json storage.rules functions/
git commit -m "feat: Firebase project setup with RTDB, Storage, Functions"
```

---

## Task 4: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export type GamePhase = 'setup' | 'clue-submission' | 'quiz' | 'finished'

export interface GameMeta {
  phase: GamePhase
  hostSecret: string
  createdAt: number
  memberCount: number
  revealIntervalSeconds: number  // 8–20, default 12
  roundOrder?: string[]          // set at quiz start
  currentRound?: number
}

export interface Member {
  id: string
  name: string
  photo: string               // URL or emoji
  assignedTo: [string, string]   // memberIds this player gives clues for
  givesFrom: [string, string]    // memberIds that give clues for this member
}

export interface ClueSet {
  0?: string | null   // Storage URL
  1?: string | null
  2?: string | null
  submittedAt?: number
}

// clues[targetMemberId][giverMemberId] = ClueSet
export type CluesData = Record<string, Record<string, ClueSet>>

export interface Guess {
  answer: string
  clueIndex: number   // 0-based index of clue when guess was made
  correct: boolean
  timestamp: number
  attemptNumber: number  // 1, 2, or 3
}

export interface Round {
  targetMemberId: string
  availableClueCount: number
  timerPaused: boolean
  currentClueIndex: number   // -1 = not started
  votingOpen: boolean
  revealed: boolean
  guesses?: Record<string, Guess>  // key = guessingMemberId
}

export interface PlayerScore {
  guessing: number
  clueing: number
  total: number
  correctGuessCount: number
}

export interface Game {
  meta: GameMeta
  members: Record<string, Member>
  clues?: CluesData
  rounds?: Record<string, Round>  // key = round index (string)
  scores?: Record<string, PlayerScore>
}

// Local player state (stored in localStorage)
export interface LocalPlayer {
  gameCode: string
  memberId: string
  hostSecret?: string   // only set for organizer
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 5: Assignment algorithm + tests

**Files:**
- Create: `src/lib/assignments.ts`
- Create: `src/lib/assignments.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/assignments.test.ts
import { describe, it, expect } from 'vitest'
import { generateAssignments } from './assignments'

describe('generateAssignments', () => {
  it('assigns each member exactly 2 targets', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const result = generateAssignments(ids)
    for (const id of ids) {
      expect(result[id].assignedTo).toHaveLength(2)
    }
  })

  it('each member is assigned as target by exactly 2 givers', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const result = generateAssignments(ids)
    for (const targetId of ids) {
      const givers = Object.entries(result)
        .filter(([, m]) => m.assignedTo.includes(targetId))
        .map(([id]) => id)
      expect(givers).toHaveLength(2)
    }
  })

  it('no member is assigned to themselves', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const result = generateAssignments(ids)
    for (const id of ids) {
      expect(result[id].assignedTo).not.toContain(id)
    }
  })

  it('works for min size (6 members)', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `m${i}`)
    expect(() => generateAssignments(ids)).not.toThrow()
  })

  it('works for max size (20 members)', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `m${i}`)
    expect(() => generateAssignments(ids)).not.toThrow()
  })
})
```

- [ ] **Step 2: Install vitest and run — confirm FAIL**

```bash
npm install -D vitest
npx vitest run src/lib/assignments.test.ts
```
Expected: FAIL — `generateAssignments` not found.

- [ ] **Step 3: Add vitest to `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/who-dis/',
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Implement `src/lib/assignments.ts`**

```ts
interface AssignmentResult {
  assignedTo: [string, string]
  givesFrom: [string, string]
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateAssignments(
  memberIds: string[]
): Record<string, AssignmentResult> {
  const shuffled = shuffle(memberIds)
  const n = shuffled.length
  const result: Record<string, AssignmentResult> = {}

  for (let i = 0; i < n; i++) {
    const id = shuffled[i]
    const target1 = shuffled[(i + 1) % n]
    const target2 = shuffled[(i + 2) % n]
    result[id] = {
      assignedTo: [target1, target2],
      givesFrom: ['', ''],  // filled in second pass
    }
  }

  // Fill givesFrom
  for (const [giverId, data] of Object.entries(result)) {
    for (const targetId of data.assignedTo) {
      const target = result[targetId]
      if (!target.givesFrom[0]) {
        target.givesFrom[0] = giverId
      } else {
        target.givesFrom[1] = giverId
      }
    }
  }

  return result
}
```

- [ ] **Step 5: Run tests — confirm PASS**

```bash
npx vitest run src/lib/assignments.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assignments.ts src/lib/assignments.test.ts vite.config.ts package.json
git commit -m "feat: circular assignment algorithm with tests"
```

---

## Task 6: Game code generation + `createGame` Cloud Function

**Files:**
- Create: `src/lib/gameCode.ts`
- Create: `functions/src/createGame.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `src/lib/gameCode.ts`**

```ts
export function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}
```

- [ ] **Step 2: Create `functions/src/createGame.ts`**

```ts
import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { v4 as uuidv4 } from 'uuid'
import { generateAssignments } from './assignments'
import { generateGameCode } from './gameCode'

// Copy these from src/lib/ — functions can't import from src/
// (Or symlink — but copying is simpler for this project size)

interface CreateGameRequest {
  members: Array<{ name: string; photo: string }>
}

export const createGame = onCall(async (request) => {
  const { members } = request.data as CreateGameRequest

  if (!members || members.length < 6 || members.length > 20) {
    throw new HttpsError('invalid-argument', 'Need 6–20 members')
  }

  const db = admin.database()

  // Generate unique game code (up to 10 retries)
  let gameCode = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateGameCode()
    const snap = await db.ref(`games/${candidate}`).get()
    if (!snap.exists()) {
      gameCode = candidate
      break
    }
  }
  if (!gameCode) throw new HttpsError('internal', 'Could not generate unique game code')

  // Generate member IDs and assignments
  const memberIds = members.map((_, i) => `m${i}`)
  const assignments = generateAssignments(memberIds)

  const membersData: Record<string, object> = {}
  members.forEach((m, i) => {
    const id = memberIds[i]
    membersData[id] = {
      name: m.name,
      photo: m.photo,
      assignedTo: assignments[id].assignedTo,
      givesFrom: assignments[id].givesFrom,
    }
  })

  const hostSecret = uuidv4()

  await db.ref(`games/${gameCode}`).set({
    meta: {
      phase: 'clue-submission',
      hostSecret,
      createdAt: Date.now(),
      memberCount: members.length,
      revealIntervalSeconds: 12,
    },
    members: membersData,
  })

  return { gameCode, hostSecret }
})
```

- [ ] **Step 3: Copy `generateAssignments` and `generateGameCode` into `functions/src/`**

```bash
cp src/lib/assignments.ts functions/src/assignments.ts
cp src/lib/gameCode.ts functions/src/gameCode.ts
```

Note: Keep these in sync manually if the source changes. They're small utilities.

- [ ] **Step 4: Update `functions/src/index.ts`**

```ts
import * as admin from 'firebase-admin'
admin.initializeApp()

export { createGame } from './createGame'
// Plan 2 will add: startQuiz, submitGuess, hostAction, scoreRound
```

- [ ] **Step 5: Build and deploy functions**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions,database,storage
```

- [ ] **Step 6: Commit**

```bash
git add functions/ src/lib/gameCode.ts
git commit -m "feat: createGame Cloud Function with circular assignment"
```

---

## Task 7: `useGame` and `useLocalPlayer` hooks

**Files:**
- Create: `src/hooks/useGame.ts`
- Create: `src/hooks/useLocalPlayer.ts`

- [ ] **Step 1: Create `src/hooks/useLocalPlayer.ts`**

```ts
import { useState, useCallback } from 'react'
import type { LocalPlayer } from '../types'

const KEY = 'who-dis-player'

export function useLocalPlayer() {
  const [player, setPlayerState] = useState<LocalPlayer | null>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const setPlayer = useCallback((p: LocalPlayer | null) => {
    if (p) {
      localStorage.setItem(KEY, JSON.stringify(p))
    } else {
      localStorage.removeItem(KEY)
    }
    setPlayerState(p)
  }, [])

  const isHost = (gameCode: string) =>
    player?.gameCode === gameCode && !!player?.hostSecret

  return { player, setPlayer, isHost }
}
```

- [ ] **Step 2: Create `src/hooks/useGame.ts`**

```ts
import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'
import type { Game } from '../types'

export function useGame(gameCode: string | undefined) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameCode) return
    const gameRef = ref(db, `games/${gameCode}`)
    const unsub = onValue(
      gameRef,
      (snap) => {
        if (snap.exists()) {
          setGame(snap.val() as Game)
        } else {
          setError('Game not found')
        }
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [gameCode])

  return { game, loading, error }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/
git commit -m "feat: useGame RTDB hook and useLocalPlayer localStorage hook"
```

---

## Task 8: Image upload utility

**Files:**
- Create: `src/lib/imageUtils.ts`

- [ ] **Step 1: Create `src/lib/imageUtils.ts`**

```ts
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'

/**
 * Center-crops an image file to 3:4 aspect ratio using a canvas,
 * then returns a Blob at the cropped dimensions.
 */
export async function cropTo3x4(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const targetRatio = 3 / 4
      let sx = 0, sy = 0, sw = img.width, sh = img.height
      const currentRatio = img.width / img.height

      if (currentRatio > targetRatio) {
        // Too wide — crop sides
        sw = img.height * targetRatio
        sx = (img.width - sw) / 2
      } else {
        // Too tall — crop top/bottom
        sh = img.width / targetRatio
        sy = (img.height - sh) / 2
      }

      const canvas = document.createElement('canvas')
      canvas.width = 600   // Output width
      canvas.height = 800  // Output height (3:4)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 600, 800)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = reject
    img.src = url
  })
}

/**
 * Upload a cropped image to Firebase Storage.
 * Returns the download URL.
 */
export async function uploadClueImage(
  gameCode: string,
  targetMemberId: string,
  giverMemberId: string,
  slotIndex: number,
  file: File
): Promise<string> {
  const cropped = await cropTo3x4(file)
  const path = `clues/${gameCode}/${targetMemberId}/${giverMemberId}/${slotIndex}.jpg`
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, cropped, { contentType: 'image/jpeg' })
  return getDownloadURL(fileRef)
}

/**
 * Delete a clue image from Storage (best-effort, non-blocking).
 */
export function deleteClueImage(url: string): void {
  try {
    const fileRef = storageRef(storage, url)
    deleteObject(fileRef).catch(() => {/* dangling file — harmless */})
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/imageUtils.ts
git commit -m "feat: image upload utility with 3:4 center-crop"
```

---

## Task 9: Shared UI components

**Files:**
- Create: `src/components/MemberAvatar.tsx`
- Create: `src/components/ImageUploadSlot.tsx`
- Create: `src/components/ProgressBar.tsx`

- [ ] **Step 1: Create `src/components/MemberAvatar.tsx`**

```tsx
interface Props {
  name: string
  photo: string   // URL or emoji
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'w-8 h-8 text-lg', md: 'w-12 h-12 text-2xl', lg: 'w-16 h-16 text-3xl' }

export function MemberAvatar({ name, photo, size = 'md' }: Props) {
  const isEmoji = !photo.startsWith('http')
  return (
    <div className="flex items-center gap-3">
      <div className={`${sizes[size]} rounded-full bg-[#F0ECE4] flex items-center justify-center overflow-hidden flex-shrink-0 border border-border`}>
        {isEmoji
          ? <span>{photo}</span>
          : <img src={photo} alt={name} className="w-full h-full object-cover" />
        }
      </div>
      <span className="font-semibold text-[#1a1a1a]">{name}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ImageUploadSlot.tsx`**

```tsx
import { useRef, useState } from 'react'
import { uploadClueImage, deleteClueImage } from '../lib/imageUtils'

interface Props {
  gameCode: string
  targetMemberId: string
  giverMemberId: string
  slotIndex: number
  currentUrl?: string | null
  onUploaded: (url: string) => void
}

export function ImageUploadSlot({
  gameCode, targetMemberId, giverMemberId, slotIndex, currentUrl, onUploaded
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      if (currentUrl) deleteClueImage(currentUrl)
      const url = await uploadClueImage(gameCode, targetMemberId, giverMemberId, slotIndex, file)
      onUploaded(url)
    } catch {
      setError('Upload failed — try again')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="aspect-[3/4] rounded-xl border-2 border-dashed border-border bg-[#F8F5F0] flex items-center justify-center cursor-pointer hover:border-accent transition-colors relative overflow-hidden"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file?.type.startsWith('image/')) handleFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {currentUrl ? (
        <img src={currentUrl} alt="clue" className="w-full h-full object-cover" />
      ) : uploading ? (
        <div className="text-muted text-sm">Uploading…</div>
      ) : (
        <div className="text-center text-muted text-sm px-2">
          <div className="text-2xl mb-1">+</div>
          <div>Tap or drop</div>
        </div>
      )}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-danger text-white text-xs rounded px-2 py-1 text-center">{error}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/ProgressBar.tsx`**

```tsx
interface Props {
  submitted: number
  total: number
}

export function ProgressBar({ submitted, total }: Props) {
  const pct = total > 0 ? (submitted / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-sm text-[#888] mb-2">
        <span>Submissions</span>
        <span className="font-semibold text-[#1a1a1a]">{submitted} / {total}</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: MemberAvatar, ImageUploadSlot, ProgressBar components"
```

---

## Task 10: Landing screen

**Files:**
- Create: `src/screens/Landing.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/screens/Landing.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'

export function Landing() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-4">A team guessing game</p>
        <h1 className="font-lora text-6xl font-bold tracking-tight mb-4">
          who <span className="text-accent">dis</span>?
        </h1>
        <p className="text-[#888] text-lg mb-12 leading-relaxed">
          Visual clues. Mystery teammates. Race to guess who's who.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/who-dis/setup"
            className="h-14 px-10 bg-[#1a1a1a] text-cream font-semibold rounded-full flex items-center justify-center hover:opacity-85 transition-opacity"
          >
            Host a game
          </a>
          <JoinForm />
        </div>
      </div>
    </div>
  )
}

function JoinForm() {
  const navigate = useNavigate()
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const code = (e.currentTarget.elements.namedItem('code') as HTMLInputElement).value.trim().toUpperCase()
        if (code.length === 6) navigate(`/join/${code}`)
      }}
    >
      <input
        name="code"
        maxLength={6}
        placeholder="Game code"
        className="h-14 px-6 border border-border rounded-full bg-white text-[#1a1a1a] font-semibold tracking-widest uppercase text-center w-40 focus:outline-none focus:border-[#1a1a1a] transition-colors"
      />
      <button
        type="submit"
        className="h-14 px-8 bg-[#1a1a1a] text-cream font-semibold rounded-full hover:opacity-85 transition-opacity"
      >
        Join
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx`** — import real screens as they're built

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Landing } from './screens/Landing'

export default function App() {
  return (
    <BrowserRouter basename="/who-dis">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/setup" element={<div>Setup</div>} />
        <Route path="/join/:code" element={<div>Join</div>} />
        <Route path="/submit/:code" element={<div>Submit</div>} />
        <Route path="/monitor/:code" element={<div>Monitor</div>} />
        <Route path="/quiz/:code" element={<div>Quiz (Plan 2)</div>} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Test locally**

```bash
npm run dev
```
Open `http://localhost:5173/who-dis/`. Verify landing page renders with title, CTAs, and join form.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Landing.tsx src/App.tsx
git commit -m "feat: Landing screen"
```

---

## Task 11: Setup screen (organizer)

**Files:**
- Create: `src/screens/Setup.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/screens/Setup.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { MemberAvatar } from '../components/MemberAvatar'

interface MemberInput { name: string; photo: string }

const AVATARS = ['👩‍💼', '👨‍💼', '🧑‍💻', '👩‍🎨', '👨‍🎤', '🧑‍🔬', '👩‍🚀', '👨‍🍳']

export function Setup() {
  const navigate = useNavigate()
  const { setPlayer } = useLocalPlayer()
  const [members, setMembers] = useState<MemberInput[]>([
    { name: '', photo: AVATARS[0] },
    { name: '', photo: AVATARS[1] },
  ])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addMember() {
    if (members.length >= 20) return
    setMembers(m => [...m, { name: '', photo: AVATARS[m.length % AVATARS.length] }])
  }

  function updateMember(i: number, field: keyof MemberInput, value: string) {
    setMembers(m => m.map((mem, idx) => idx === i ? { ...mem, [field]: value } : mem))
  }

  function removeMember(i: number) {
    if (members.length <= 6) return
    setMembers(m => m.filter((_, idx) => idx !== i))
  }

  async function handleCreate() {
    const valid = members.filter(m => m.name.trim())
    if (valid.length < 6) { setError('Need at least 6 members with names'); return }
    setCreating(true)
    setError(null)
    try {
      const fn = httpsCallable(functions, 'createGame')
      const result = await fn({ members: valid }) as { data: { gameCode: string; hostSecret: string } }
      const { gameCode, hostSecret } = result.data
      setPlayer({ gameCode, memberId: 'host', hostSecret })
      navigate(`/monitor/${gameCode}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create game')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream px-6 py-12 max-w-2xl mx-auto">
      <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-2">New Game</p>
      <h1 className="font-lora text-4xl font-bold tracking-tight mb-2">Set up your team</h1>
      <p className="text-[#888] mb-10">Add 6–20 members. Each will be assigned 2 people to give clues for.</p>

      <div className="flex flex-col gap-3 mb-6">
        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3">
            <select
              value={m.photo}
              onChange={e => updateMember(i, 'photo', e.target.value)}
              className="text-2xl bg-transparent border-none outline-none cursor-pointer"
            >
              {AVATARS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input
              value={m.name}
              onChange={e => updateMember(i, 'name', e.target.value)}
              placeholder={`Member ${i + 1}`}
              className="flex-1 bg-transparent outline-none font-semibold text-[#1a1a1a] placeholder:text-muted"
            />
            {members.length > 6 && (
              <button onClick={() => removeMember(i)} className="text-muted hover:text-danger transition-colors text-lg">×</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-10">
        {members.length < 20 && (
          <button onClick={addMember} className="h-11 px-6 border border-border rounded-full text-sm font-semibold text-[#888] hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-colors">
            + Add member
          </button>
        )}
        <span className="text-sm text-muted self-center">{members.filter(m => m.name.trim()).length} / 20</span>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating}
        className="h-14 px-10 bg-[#1a1a1a] text-cream font-semibold rounded-full hover:opacity-85 transition-opacity disabled:opacity-50"
      >
        {creating ? 'Creating…' : 'Create game'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx`** — add Setup import

```tsx
import { Setup } from './screens/Setup'
// ...
<Route path="/setup" element={<Setup />} />
```

- [ ] **Step 3: Test locally** — create a game with 6 members, verify redirect to `/monitor/:code`

- [ ] **Step 4: Commit**

```bash
git add src/screens/Setup.tsx src/App.tsx
git commit -m "feat: Setup screen with createGame Cloud Function call"
```

---

## Task 12: Join screen + Clue Submission screen

**Files:**
- Create: `src/screens/JoinGame.tsx`
- Create: `src/screens/ClueSubmission.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/screens/JoinGame.tsx`**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'

export function JoinGame() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { setPlayer } = useLocalPlayer()
  const navigate = useNavigate()
  const [selected, setSelected] = useState('')

  if (loading) return <Loading />
  if (!game) return <div className="p-12 text-center text-muted">Game not found</div>

  const members = Object.entries(game.members)

  function handleJoin() {
    if (!selected || !code) return
    setPlayer({ gameCode: code, memberId: selected })
    navigate(`/submit/${code}`)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-2">Game {code}</p>
        <h1 className="font-lora text-4xl font-bold tracking-tight mb-2">Who are you?</h1>
        <p className="text-[#888] mb-8">Select your name to get your clue assignments.</p>

        <div className="flex flex-col gap-2 mb-8">
          {members.map(([id, m]) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left transition-colors ${
                selected === id
                  ? 'border-[#1a1a1a] bg-white'
                  : 'border-border bg-white hover:border-[#C4B9A8]'
              }`}
            >
              <span className="text-2xl">{m.photo.startsWith('http') ? '👤' : m.photo}</span>
              <span className="font-semibold">{m.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleJoin}
          disabled={!selected}
          className="w-full h-14 bg-[#1a1a1a] text-cream font-semibold rounded-full disabled:opacity-40 hover:opacity-85 transition-opacity"
        >
          Let's go
        </button>
      </div>
    </div>
  )
}

function Loading() {
  return <div className="min-h-screen bg-cream flex items-center justify-center text-muted">Loading…</div>
}
```

- [ ] **Step 2: Create `src/screens/ClueSubmission.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { ref as dbRef, update } from 'firebase/database'
import { db } from '../firebase'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { ImageUploadSlot } from '../components/ImageUploadSlot'
import { MemberAvatar } from '../components/MemberAvatar'

export function ClueSubmission() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { player } = useLocalPlayer()

  if (loading || !game || !player) return <Loading />

  const me = game.members[player.memberId]
  if (!me) return <div className="p-12 text-center text-muted">Player not found</div>

  const assignedMembers = me.assignedTo.map(id => ({ id, ...game.members[id] }))

  async function handleUploaded(targetId: string, slot: number, url: string) {
    if (!code || !player) return
    await update(dbRef(db, `games/${code}/clues/${targetId}/${player.memberId}`), {
      [slot]: url,
      submittedAt: Date.now(),
    })
  }

  const cluesForMe = (targetId: string) =>
    game?.clues?.[targetId]?.[player!.memberId] ?? {}

  const totalUploaded = assignedMembers.reduce((sum, t) => {
    const c = cluesForMe(t.id)
    return sum + [0, 1, 2].filter(i => c[i as 0|1|2]).length
  }, 0)

  return (
    <div className="min-h-screen bg-cream px-6 py-12 max-w-2xl mx-auto">
      <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-2">Game {code}</p>
      <h1 className="font-lora text-4xl font-bold tracking-tight mb-2">Your clues</h1>
      <p className="text-[#888] mb-3 leading-relaxed">
        Upload 3 images for each person — anything that captures who they are.
      </p>

      {/* Uniqueness reminder */}
      <div className="bg-[#FFF6F3] border border-[#FFD5C8] rounded-xl px-4 py-3 mb-10 text-sm text-[#888] leading-relaxed">
        <span className="font-semibold text-accent">Heads up:</span> If your clues are too similar to another player's for the same person, you'll lose points. The more unique and specific, the better.
      </div>

      <div className="flex flex-col gap-12">
        {assignedMembers.map((target) => {
          const existing = cluesForMe(target.id)
          return (
            <div key={target.id}>
              <div className="mb-4">
                <MemberAvatar name={target.name} photo={target.photo} size="md" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((slot) => (
                  <ImageUploadSlot
                    key={slot}
                    gameCode={code!}
                    targetMemberId={target.id}
                    giverMemberId={player.memberId}
                    slotIndex={slot}
                    currentUrl={existing[slot as 0|1|2]}
                    onUploaded={(url) => handleUploaded(target.id, slot, url)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-12 pt-8 border-t border-border">
        <p className="text-sm text-[#888]">
          {totalUploaded} / 6 uploaded
          {totalUploaded === 6 && <span className="text-accent font-semibold ml-2">— All done! ✓</span>}
        </p>
        <p className="text-xs text-muted mt-1">You can come back and swap any image before the game starts.</p>
      </div>
    </div>
  )
}

function Loading() {
  return <div className="min-h-screen bg-cream flex items-center justify-center text-muted">Loading…</div>
}
```

- [ ] **Step 3: Update `src/App.tsx`**

```tsx
import { JoinGame } from './screens/JoinGame'
import { ClueSubmission } from './screens/ClueSubmission'
// ...
<Route path="/join/:code" element={<JoinGame />} />
<Route path="/submit/:code" element={<ClueSubmission />} />
```

- [ ] **Step 4: Test locally**

1. Create a game via `/setup`
2. Open `/join/{code}`, select a member, submit clues
3. Verify images appear in Firebase Storage and URLs write to RTDB

- [ ] **Step 5: Commit**

```bash
git add src/screens/JoinGame.tsx src/screens/ClueSubmission.tsx src/App.tsx
git commit -m "feat: JoinGame and ClueSubmission screens"
```

---

## Task 13: Submission Monitor screen

**Files:**
- Create: `src/screens/SubmissionMonitor.tsx`
- Create: `functions/src/startQuiz.ts`
- Modify: `functions/src/index.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `functions/src/startQuiz.ts`**

```ts
import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const startQuiz = onCall(async (request) => {
  const { gameCode, hostSecret, revealIntervalSeconds } = request.data as {
    gameCode: string
    hostSecret: string
    revealIntervalSeconds?: number
  }
  const db = admin.database()
  const snap = await db.ref(`games/${gameCode}/meta`).get()
  if (!snap.exists()) throw new HttpsError('not-found', 'Game not found')

  const meta = snap.val()
  if (meta.hostSecret !== hostSecret) throw new HttpsError('permission-denied', 'Invalid host secret')
  if (meta.phase !== 'clue-submission') throw new HttpsError('failed-precondition', 'Game not in submission phase')

  // Build round order from member IDs
  const membersSnap = await db.ref(`games/${gameCode}/members`).get()
  const memberIds = Object.keys(membersSnap.val() ?? {})
  const roundOrder = shuffle(memberIds)

  // Compute availableClueCount for each round
  const cluesSnap = await db.ref(`games/${gameCode}/clues`).get()
  const clues = cluesSnap.val() ?? {}
  const rounds: Record<string, object> = {}

  roundOrder.forEach((targetId, index) => {
    const targetClues = clues[targetId] ?? {}
    const availableClueCount = Object.values(targetClues).reduce((sum: number, giverClues: unknown) => {
      const gc = giverClues as Record<string, unknown>
      return sum + [0, 1, 2].filter(i => gc[i] != null).length
    }, 0)
    rounds[index] = {
      targetMemberId: targetId,
      availableClueCount,
      timerPaused: false,
      currentClueIndex: -1,
      votingOpen: false,
      revealed: false,
    }
  })

  const intervalSecs = revealIntervalSeconds
    ? Math.min(20, Math.max(8, revealIntervalSeconds))
    : 12

  await db.ref(`games/${gameCode}`).update({
    'meta/phase': 'quiz',
    'meta/roundOrder': roundOrder,
    'meta/currentRound': 0,
    'meta/revealIntervalSeconds': intervalSecs,
    rounds,
  })

  return { ok: true }
})
```

- [ ] **Step 2: Update `functions/src/index.ts`**

```ts
export { createGame } from './createGame'
export { startQuiz } from './startQuiz'
```

- [ ] **Step 3: Create `src/screens/SubmissionMonitor.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { ProgressBar } from '../components/ProgressBar'

export function SubmissionMonitor() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { player } = useLocalPlayer()
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interval, setIntervalSecs] = useState(12)

  if (loading || !game) return <Loading />

  const members = Object.entries(game.members)
  const submitted = members.filter(([id]) => {
    const assignedTo = game.members[id].assignedTo
    return assignedTo.every(targetId => {
      const clueSet = game.clues?.[targetId]?.[id] ?? {}
      return [0, 1, 2].every(i => clueSet[i as 0|1|2] != null)
    })
  }).length

  async function handleStart() {
    if (!code || !player?.hostSecret) return
    setStarting(true)
    setError(null)
    try {
      // Pass interval to startQuiz — function writes it server-side (client cannot write meta directly)
      const fn = httpsCallable(functions, 'startQuiz')
      await fn({ gameCode: code, hostSecret: player.hostSecret, revealIntervalSeconds: interval })
      navigate(`/quiz/${code}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start quiz')
      setStarting(false)
    }
  }

  // Redirect non-host players to quiz if it starts
  if (game.meta.phase === 'quiz' && !player?.hostSecret) {
    navigate(`/quiz/${code}`)
    return null
  }

  return (
    <div className="min-h-screen bg-cream px-6 py-12 max-w-2xl mx-auto">
      <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-2">Game {code}</p>
      <h1 className="font-lora text-4xl font-bold tracking-tight mb-2">Waiting room</h1>
      <p className="text-[#888] mb-8">Share the game code with your team. Start when you're ready.</p>

      <div className="mb-8">
        <ProgressBar submitted={submitted} total={members.length} />
      </div>

      {/* Member grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {members.map(([id, m]) => {
          const assignedTo = m.assignedTo
          const slotsFilled = assignedTo.reduce((sum, targetId) => {
            const c = game.clues?.[targetId]?.[id] ?? {}
            return sum + [0, 1, 2].filter(i => c[i as 0|1|2] != null).length
          }, 0)
          const done = slotsFilled === 6
          return (
            <div
              key={id}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${done ? 'border-[#1A9E5C] bg-[#EDFAF3]' : 'border-border bg-white'}`}
            >
              <span className="text-xl">{m.photo.startsWith('http') ? '👤' : m.photo}</span>
              <div>
                <p className="font-semibold text-sm">{m.name}</p>
                <p className={`text-xs ${done ? 'text-[#1A9E5C]' : 'text-muted'}`}>{slotsFilled}/6</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Timer setting */}
      <div className="flex items-center gap-4 mb-8">
        <span className="text-sm font-semibold text-[#888]">Seconds between clues</span>
        <button onClick={() => setIntervalSecs(s => Math.max(8, s - 1))} className="w-9 h-9 rounded-full border border-border flex items-center justify-center font-bold hover:border-[#1a1a1a] transition-colors">−</button>
        <span className="font-lora text-2xl font-bold w-8 text-center">{interval}</span>
        <button onClick={() => setIntervalSecs(s => Math.min(20, s + 1))} className="w-9 h-9 rounded-full border border-border flex items-center justify-center font-bold hover:border-[#1a1a1a] transition-colors">+</button>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <button
        onClick={handleStart}
        disabled={starting}
        className="h-14 px-10 bg-[#1a1a1a] text-cream font-semibold rounded-full hover:opacity-85 transition-opacity disabled:opacity-50"
      >
        {starting ? 'Starting…' : 'Start quiz'}
      </button>
    </div>
  )
}

function Loading() {
  return <div className="min-h-screen bg-cream flex items-center justify-center text-muted">Loading…</div>
}
```

- [ ] **Step 4: Update `src/App.tsx`**

```tsx
import { SubmissionMonitor } from './screens/SubmissionMonitor'
// ...
<Route path="/monitor/:code" element={<SubmissionMonitor />} />
```

- [ ] **Step 5: Deploy functions and test full pre-game flow**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions
npm run dev
```

End-to-end test:
1. `/setup` → create game → land on `/monitor/:code` ✓
2. Open `/join/:code` in another tab → select name → land on `/submit/:code` ✓
3. Upload 6 images → monitor shows progress update ✓
4. Hit "Start quiz" → game phase changes to `quiz` ✓

- [ ] **Step 6: Commit and push**

```bash
git add src/screens/SubmissionMonitor.tsx src/App.tsx functions/src/startQuiz.ts functions/src/index.ts
git commit -m "feat: SubmissionMonitor with startQuiz Cloud Function"
git push
```

Expected: GitHub Actions deploys successfully. Full pre-game flow works on `https://shravandr.github.io/who-dis/`.

---

## Plan 1 Complete ✓

At this point:
- Live at `https://shravandr.github.io/who-dis/`
- Organizer can create a game and share a code
- Players can join and submit 6 image clues
- Organizer monitors progress and starts the quiz
- Game transitions to `quiz` phase — ready for Plan 2

**Next:** `2026-03-28-who-dis-plan-2-quiz-engine.md`
