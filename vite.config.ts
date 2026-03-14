import { defineConfig, Plugin, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev: proxy /api/ai → Anthropic API directly (no CORS issues)
function localAiProxy(envApiKey: string): Plugin {
  return {
    name: 'local-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { prompt, systemPrompt, apiKey: clientKey } = JSON.parse(body);
            const apiKey = clientKey || envApiKey;
            if (!apiKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'API key required. 설정에서 입력하세요.' }));
              return;
            }
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4000,
                system: systemPrompt || 'You are a helpful assistant. Always respond in Korean.',
                messages: [{ role: 'user', content: prompt }],
              }),
            });
            const data = await response.text();
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(data);
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), localAiProxy(env.ANTHROPIC_API_KEY || '')],
    server: {
      open: true,
      port: 3000,
    },
  };
})
