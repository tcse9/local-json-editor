import { defineConfig, type Connect, type Plugin, type ViteDevServer, type PreviewServer } from 'vite';
import { exec } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';

const CURL_ENDPOINT = '/api/curl-run';

/**
 * Dev/preview-only endpoint that lets the browser-mode UI execute curl
 * commands the same way the Electron build does over IPC. Only wired into
 * `vite`/`vite preview` (both Node processes) — never bundled into the
 * static `dist/` output, and never reachable from a page on another origin.
 */
function curlExecutorMiddleware(): Plugin {
  const handler: Connect.NextHandleFunction = (req: IncomingMessage, res: ServerResponse, next) => {
    if (req.url !== CURL_ENDPOINT) {
      next();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }

    // Reject cross-origin requests so an arbitrary web page can't script
    // this machine's curl by POSTing to a developer's local dev server.
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
      res.statusCode = 403;
      res.end(JSON.stringify({ ok: false, error: 'Cross-origin requests are not allowed.' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      let command = '';
      try {
        command = JSON.parse(body || '{}').command ?? '';
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Invalid request body.' }));
        return;
      }

      const trimmed = typeof command === 'string' ? command.trim() : '';
      res.setHeader('Content-Type', 'application/json');

      if (!/^curl\b/i.test(trimmed)) {
        res.end(JSON.stringify({ ok: false, error: 'Command must start with "curl".' }));
        return;
      }

      exec(
        trimmed,
        { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error && error.killed) {
            res.end(JSON.stringify({ ok: false, error: 'Command timed out after 30s.' }));
            return;
          }
          res.end(
            JSON.stringify({
              ok: true,
              exitCode: error ? (error.code ?? 1) : 0,
              stdout,
              stderr,
            }),
          );
        },
      );
    });
  };

  return {
    name: 'curl-executor-dev-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [curlExecutorMiddleware()],
  server: {
    port: 5173,
  },
});
