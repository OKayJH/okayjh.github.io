export const prerender = false;
import type { APIRoute } from 'astro';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execFilePromise = util.promisify(execFile);

export const POST: APIRoute = async ({ request }) => {
    if (import.meta.env.PROD) {
        return new Response(JSON.stringify({ error: 'Endpoint only available in dev mode' }), { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, originalSlug } = body;

        const projectRoot = process.cwd();

        // If this was an edit, rename draft file to final
        if (originalSlug) {
            const draftPath = path.join(projectRoot, 'src', 'content', 'blog', `${originalSlug}-draft.md`);
            const finalPath = path.join(projectRoot, 'src', 'content', 'blog', `${originalSlug}.md`);

            if (fs.existsSync(draftPath)) {
                let content = fs.readFileSync(draftPath, 'utf8');
                content = content.replace(/^draft:\s*true/m, 'draft: false');
                fs.writeFileSync(finalPath, content, 'utf8');
                fs.unlinkSync(draftPath);
            }
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

        return new Response(JSON.stringify({ success: true, message: 'Published and synced to GitHub' }), { status: 200 });

    } catch (e: any) {
        console.error("Publish error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
