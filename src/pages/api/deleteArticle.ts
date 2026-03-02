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
        const { slug, syncToGithub } = body;

        if (!slug) {
            return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
        }

        const projectRoot = process.cwd();
        const blogDir = path.join(projectRoot, 'src', 'content', 'blog');
        const gitOpts = { cwd: projectRoot };

        // Check for both normal and draft files
        const normalFile = path.join(blogDir, `${slug}.md`);
        const draftFile = path.join(blogDir, `${slug}-draft.md`);
        const mdxFile = path.join(blogDir, `${slug}.mdx`);

        let deleted = false;

        if (fs.existsSync(normalFile)) {
            fs.unlinkSync(normalFile);
            deleted = true;
        }
        if (fs.existsSync(draftFile)) {
            fs.unlinkSync(draftFile);
            deleted = true;
        }
        if (fs.existsSync(mdxFile)) {
            fs.unlinkSync(mdxFile);
            deleted = true;
        }

        if (!deleted) {
            return new Response(JSON.stringify({ error: `Article "${slug}" not found` }), { status: 404 });
        }

        // Sync deletion to GitHub
        if (syncToGithub) {
            try {
                await execFilePromise('git', ['add', 'src/content/blog/'], gitOpts);
                await execFilePromise('git', ['commit', '-m', `docs: delete ${slug}`], gitOpts);
                await execFilePromise('git', ['push'], gitOpts);
            } catch (gitErr: any) {
                // File deleted locally but git sync failed
                const msg = gitErr.stderr || gitErr.message || '';
                return new Response(JSON.stringify({
                    success: true,
                    message: `Article deleted locally, but GitHub sync failed: ${msg}`,
                    gitError: true
                }), { status: 200 });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: syncToGithub ? `Deleted and synced: ${slug}` : `Deleted locally: ${slug}`
        }), { status: 200 });

    } catch (e: any) {
        console.error("Delete error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
