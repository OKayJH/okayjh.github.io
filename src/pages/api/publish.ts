export const prerender = false;
import type { APIRoute } from 'astro';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execFilePromise = util.promisify(execFile);
type PublishStatus = 'running' | 'success' | 'error';
type PublishStore = Record<string, {
    status: PublishStatus;
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

function writePublishStore(projectRoot: string, store: PublishStore): void {
    const filePath = getPublishStorePath(projectRoot);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
}

function setPublishStatus(
    projectRoot: string,
    publishId: string,
    status: PublishStatus,
    message: string,
    slug?: string
): void {
    if (!publishId) return;

    const store = readPublishStore(projectRoot);
    store[publishId] = {
        status,
        message,
        slug: slug || undefined,
        updatedAt: new Date().toISOString()
    };

    // Keep only latest 100 jobs to prevent unbounded growth.
    const entries = Object.entries(store).sort((a, b) => {
        return new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime();
    });
    const trimmed = Object.fromEntries(entries.slice(0, 100));
    writePublishStore(projectRoot, trimmed);
}

function generateSlug(rawSlug: unknown, title: string): string {
    const candidate = typeof rawSlug === 'string' ? rawSlug.trim() : '';
    const source = candidate || title;
    const slug = source
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

    return slug && slug !== '-' ? slug : `post-${Date.now()}`;
}

export const POST: APIRoute = async ({ request }) => {
    let projectRoot = '';
    let publishId = '';

    if (import.meta.env.PROD) {
        return new Response(JSON.stringify({ error: 'Endpoint only available in dev mode' }), { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, originalSlug, slug: rawSlug, content, description, tags, cover, date, isEdit } = body;
        publishId = typeof body.publishId === 'string' ? body.publishId : '';

        projectRoot = process.cwd();
        const blogDir = path.join(projectRoot, 'src', 'content', 'blog');
        let finalSlug = '';

        setPublishStatus(projectRoot, publishId, 'running', 'Publishing in progress...');

        const hasDirectPublishPayload =
            typeof title === 'string' && title.trim().length > 0 &&
            typeof content === 'string' && content.trim().length > 0;

        if (hasDirectPublishPayload) {
            finalSlug = generateSlug(rawSlug, title.trim());
            const finalPath = path.join(blogDir, `${finalSlug}.md`);

            const cleanTags = Array.isArray(tags)
                ? tags.map((tag) => String(tag).trim()).filter(Boolean)
                : [];
            const tagsString = cleanTags.length > 0 ? `\n  - ${cleanTags.join('\n  - ')}` : '\n  - General';
            const publishDate = typeof date === 'string' && date.trim()
                ? date.trim()
                : new Date().toISOString().split('T')[0];

            const fileContent = `---
title: ${JSON.stringify(title.trim())}
date: ${publishDate}
description: ${JSON.stringify(typeof description === 'string' ? description : '')}
tags:${tagsString}
cover: ${JSON.stringify(typeof cover === 'string' ? cover : '')}
draft: false
---
${content}
`;

            fs.writeFileSync(finalPath, fileContent, 'utf8');

            if (isEdit && originalSlug) {
                const draftPath = path.join(blogDir, `${originalSlug}-draft.md`);
                if (fs.existsSync(draftPath)) {
                    fs.unlinkSync(draftPath);
                }
            }
        } else if (originalSlug) {
            // Backward compatibility: publish existing draft file by rename/overwrite.
            finalSlug = originalSlug;
            const draftPath = path.join(blogDir, `${originalSlug}-draft.md`);
            const finalPath = path.join(blogDir, `${originalSlug}.md`);

            if (fs.existsSync(draftPath)) {
                let draftContent = fs.readFileSync(draftPath, 'utf8');
                draftContent = draftContent.replace(/^draft:\s*true/m, 'draft: false');
                fs.writeFileSync(finalPath, draftContent, 'utf8');
                fs.unlinkSync(draftPath);
            }
        } else {
            return new Response(JSON.stringify({ error: 'Missing publish payload' }), { status: 400 });
        }

        const commitMessage = title ? `docs: publish ${title}` : 'docs: update articles';
        const gitOpts = { cwd: projectRoot };

        // Stage blog content
        await execFilePromise('git', ['add', 'src/content/blog/'], gitOpts);

        // Stage uploads if directory exists
        const uploadsDir = path.join(projectRoot, 'public', 'images', 'uploads');
        if (fs.existsSync(uploadsDir)) {
            try {
                await execFilePromise('git', ['add', 'public/images/uploads/'], gitOpts);
            } catch { /* ignore if nothing to add */ }
        }

        // Commit - use execFile to avoid shell escaping issues with Chinese chars
        try {
            await execFilePromise('git', ['commit', '-m', commitMessage], gitOpts);
        } catch (cErr: any) {
            const msg = cErr.stderr || cErr.stdout || cErr.message || '';
            if (!msg.includes('nothing to commit') && !msg.includes('no changes added')) {
                throw new Error(`git commit failed: ${msg}`);
            }
        }

        // Push
        await execFilePromise('git', ['push'], gitOpts);

        setPublishStatus(projectRoot, publishId, 'success', 'Published and synced to GitHub', finalSlug || undefined);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Published and synced to GitHub',
                slug: finalSlug || null,
                publishId: publishId || null
            }),
            { status: 200 }
        );

    } catch (e: any) {
        console.error("Publish error:", e);
        if (projectRoot && publishId) {
            setPublishStatus(projectRoot, publishId, 'error', e?.message || 'Unknown publish error');
        }
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};

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
