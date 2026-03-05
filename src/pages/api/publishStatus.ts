export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

type PublishStore = Record<string, {
    status: 'running' | 'success' | 'error';
    message: string;
    slug?: string;
    updatedAt: string;
}>;

function getPublishStorePath(projectRoot: string): string {
    return path.join(projectRoot, '.okay', 'publish-status.json');
}

function readPublishStore(projectRoot: string): PublishStore {
    const filePath = getPublishStorePath(projectRoot);
    if (!fs.existsSync(filePath)) return {};

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as PublishStore;
        return {};
    } catch {
        return {};
    }
}

export const GET: APIRoute = async ({ request }) => {
    if (import.meta.env.PROD) {
        return new Response(JSON.stringify({ error: 'Endpoint only available in dev mode' }), { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const id = (url.searchParams.get('id') || '').trim();
        if (!id) {
            return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
        }

        const projectRoot = process.cwd();
        const store = readPublishStore(projectRoot);
        const item = store[id];
        if (!item) {
            return new Response(JSON.stringify({ success: true, found: false }), { status: 200 });
        }

        return new Response(
            JSON.stringify({
                success: true,
                found: true,
                id,
                status: item.status,
                message: item.message,
                slug: item.slug || null,
                updatedAt: item.updatedAt
            }),
            { status: 200 }
        );
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
