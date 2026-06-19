import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const STATE_DIR = 'public/process-data'
const STATE_FILE = 'state.json'
const API_PATH = '/api/process-data'

function readRequestBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
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
