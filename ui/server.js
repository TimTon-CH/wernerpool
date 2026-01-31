import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3334;
const API_URL = process.env.API_URL || 'http://localhost:3335';

app.use(cors());

// Proxy API requests manually without http-proxy-middleware for simplicity
app.use('/api', async (req, res) => {
  try {
    const targetUrl = `${API_URL}/api${req.url}`;
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      await new Promise(resolve => req.on('end', resolve));
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text();
    
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    res.send(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to connect to API server' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WERNERPOOL UI running on port ${PORT}`);
  console.log(`API proxy target: ${API_URL}`);
});
