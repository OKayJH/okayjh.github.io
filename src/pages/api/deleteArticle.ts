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
        const { slug } = body;

        if (!slug) {
            return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
        }

        const projectRoot = process.cwd();
        const blogDir = path.join(projectRoot, 'src', 'content', 'blog');

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

        return new Response(JSON.stringify({ success: true, message: `Deleted article: ${slug}` }), { status: 200 });

    } catch (e: any) {
        console.error("Delete error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
