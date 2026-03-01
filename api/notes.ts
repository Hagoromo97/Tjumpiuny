import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        type VARCHAR(20) NOT NULL DEFAULT 'note',
        title VARCHAR(500) NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        version VARCHAR(50) DEFAULT NULL,
        author VARCHAR(255) DEFAULT 'Admin',
        pinned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    if (req.method === 'GET') {
      const { type } = req.query;
      let result;
      if (type === 'note') {
        result = await sql`SELECT * FROM notes WHERE type = 'note' ORDER BY pinned DESC, created_at DESC`;
      } else if (type === 'changelog') {
        result = await sql`SELECT * FROM notes WHERE type = 'changelog' ORDER BY created_at DESC`;
      } else {
        result = await sql`SELECT * FROM notes ORDER BY type ASC, pinned DESC, created_at DESC`;
      }
      return res.status(200).json({ success: true, data: result });
    }

    if (req.method === 'POST') {
      const { id, type, title, content, version, author, pinned } = req.body;
      if (!id || !type || !content) {
        return res.status(400).json({ success: false, error: 'id, type dan content diperlukan' });
      }
      await sql`
        INSERT INTO notes (id, type, title, content, version, author, pinned, updated_at)
        VALUES (
          ${id},
          ${type},
          ${title ?? ''},
          ${content},
          ${version ?? null},
          ${author ?? 'Admin'},
          ${pinned ?? false},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE
          SET title      = EXCLUDED.title,
              content    = EXCLUDED.content,
              version    = EXCLUDED.version,
              author     = EXCLUDED.author,
              pinned     = EXCLUDED.pinned,
              updated_at = NOW()
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ success: false, error: 'id diperlukan' });
      }
      await sql`DELETE FROM notes WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
