export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
    if (import.meta.env.PROD) {
        return new Response(JSON.stringify({ error: 'Endpoint only available in dev mode' }), { status: 403 });
    }

    try {
        const body = await request.json();
        const { base64, filename } = body;

        if (!base64) {
            return new Response(JSON.stringify({ error: 'Missing base64 data' }), { status: 400 });
        }

        const projectRoot = process.cwd();
        const uploadDir = path.join(projectRoot, 'public', 'images', 'uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const safeFilename = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, '_') : `upload_${Date.now()}.png`;
        const filePath = path.join(uploadDir, safeFilename);

        // Remove the data:image/png;base64, prefix if present
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

        fs.writeFileSync(filePath, base64Data, 'base64');

        return new Response(JSON.stringify({
            success: true,
            url: `/images/uploads/${safeFilename}`
        }), { status: 200 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
