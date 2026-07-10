import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const STATE_DIR = 'public/process-data'
// Phase 2A.1 — dev 런타임 편집은 untracked local 파일에만 write한다.
// 커밋된 시드(state.json)는 실행 중 앱이 절대 덮어쓰지 않는다(fallback/seed 전용).
const STATE_FILE = 'state.local.json'
const API_PATH = '/api/process-data'

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
          JSON.parse(body)

          const dir = path.resolve(STATE_DIR)
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(path.join(dir, STATE_FILE), body, 'utf8')

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: false,
              message: error instanceof Error ? error.message : 'Invalid payload',
            }),
          )
        }
      })
    },
  }
}
