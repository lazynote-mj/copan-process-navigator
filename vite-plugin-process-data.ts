import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const STATE_DIR = 'public/process-data'
// Phase 2A.1 — dev 런타임 편집은 untracked local 파일에만 write한다.
// 커밋된 시드(state.json)는 실행 중 앱이 절대 덮어쓰지 않는다(fallback/seed 전용).
const STATE_FILE = 'state.local.json'
// Phase 2A.2 — atomic write용 temp / 복구용 backup (둘 다 untracked, gitignore).
const TMP_FILE = 'state.local.json.tmp'
const BAK_FILE = 'state.local.bak.json'
const API_PATH = '/api/process-data'
const BASE_REVISION_HEADER = 'x-base-revision'

/**
 * Phase 2A.2 — Optimistic Save Guard 결정 (순수 함수 · 부작용 없음).
 *
 * concurrency token = 서버 소유 `revision`(파일 top-level). 매 성공 write마다 +1.
 * - 파일 없음 → bootstrap(첫 저장, revision=1). 토큰 불필요(문서화된 bootstrap).
 * - 파일 있음 + 토큰 누락/오형식 → reject(400).
 * - 파일 있음 + base ≠ current → conflict(409). **파일을 덮어쓰지 않는다.**
 * - 파일 있음 + base = current → apply(revision+1).
 */
export type SaveGuardInput = {
  fileExists: boolean
  currentRevision: number
  baseHeader: string | string[] | undefined
}

export type SaveGuardDecision =
  | { action: 'bootstrap'; nextRevision: number }
  | { action: 'apply'; nextRevision: number }
  | { action: 'conflict'; status: 409; currentRevision: number; message: string }
  | { action: 'reject'; status: 400; message: string }

export function resolveSaveGuardDecision(input: SaveGuardInput): SaveGuardDecision {
  const { fileExists, currentRevision, baseHeader } = input

  // 문서화된 bootstrap: local runtime 파일이 아직 없으면 첫 저장을 허용한다(토큰 불필요).
  if (!fileExists) {
    return { action: 'bootstrap', nextRevision: 1 }
  }

  const raw = Array.isArray(baseHeader) ? undefined : baseHeader
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return {
      action: 'reject',
      status: 400,
      message: 'X-Base-Revision 토큰이 없거나 형식이 올바르지 않습니다.',
    }
  }

  const baseRevision = Number(raw)
  if (baseRevision !== currentRevision) {
    return {
      action: 'conflict',
      status: 409,
      currentRevision,
      message: `다른 세션이 이미 저장했습니다. (현재 개정 ${currentRevision}, 요청 기반 ${baseRevision}) 최신 데이터를 다시 불러온 뒤 저장하세요.`,
    }
  }

  return { action: 'apply', nextRevision: currentRevision + 1 }
}

/** 파일의 현재 revision을 읽는다(없거나 손상 시 0). */
function readCurrentRevision(target: string): { fileExists: boolean; currentRevision: number } {
  if (!fs.existsSync(target)) return { fileExists: false, currentRevision: 0 }
  try {
    const cur = JSON.parse(fs.readFileSync(target, 'utf8')) as { revision?: unknown }
    return { fileExists: true, currentRevision: Number.isInteger(cur.revision) ? (cur.revision as number) : 0 }
  } catch {
    return { fileExists: true, currentRevision: 0 }
  }
}

function readRequestBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    // chunk를 개별 toString하면 multi-byte 문자가 chunk 경계에서 깨진다.
    // Buffer로 모아 한 번에 디코딩한다.
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function processDataApiPlugin(): Plugin {
  return {
    name: 'process-data-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(API_PATH)) {
          next()
          return
        }

        if (req.method !== 'POST' && req.method !== 'PUT') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          const body = await readRequestBody(req)
          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(body) as Record<string, unknown>
          } catch {
            sendJson(res, 400, { ok: false, message: 'Invalid JSON payload' })
            return
          }

          const dir = path.resolve(STATE_DIR)
          const target = path.join(dir, STATE_FILE)
          const { fileExists, currentRevision } = readCurrentRevision(target)

          const decision = resolveSaveGuardDecision({
            fileExists,
            currentRevision,
            baseHeader: req.headers[BASE_REVISION_HEADER],
          })

          if (decision.action === 'reject') {
            sendJson(res, decision.status, { ok: false, message: decision.message })
            return
          }
          if (decision.action === 'conflict') {
            // stale write — 절대 파일을 덮어쓰지 않는다.
            sendJson(res, decision.status, {
              ok: false,
              conflict: true,
              currentRevision: decision.currentRevision,
              message: decision.message,
            })
            return
          }

          // bootstrap | apply → 서버가 revision을 주입하고 atomic하게 기록한다.
          const nextRevision = decision.nextRevision
          fs.mkdirSync(dir, { recursive: true })
          if (fileExists) {
            try {
              fs.copyFileSync(target, path.join(dir, BAK_FILE)) // 복구 사본
            } catch {
              // backup 실패는 저장을 막지 않는다(best-effort).
            }
          }
          const outJson = JSON.stringify({ ...parsed, revision: nextRevision }, null, 2)
          const tmp = path.join(dir, TMP_FILE)
          fs.writeFileSync(tmp, outJson, 'utf8')
          fs.renameSync(tmp, target) // 같은 디렉터리 rename = atomic

          sendJson(res, 200, { ok: true, revision: nextRevision })
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            message: error instanceof Error ? error.message : 'Save failed',
          })
        }
      })
    },
  }
}
