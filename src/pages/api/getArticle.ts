export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const GET: APIRoute = async ({ request }) => {
    if (import.meta.env.PROD) {
        return new Response(JSON.stringify({ error: 'Endpoint only available in dev mode' }), { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const slug = url.searchParams.get('slug');

        if (!slug) {
            return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
        }

        const projectRoot = process.cwd();

        // Priority: check for draft first, then published
        const draftPath = path.join(projectRoot, 'src', 'content', 'blog', `${slug}-draft.md`);
        const pubPath = path.join(projectRoot, 'src', 'content', 'blog', `${slug}.md`);

        let targetPath = pubPath;
        let isDraft = false;

        if (fs.existsSync(draftPath)) {
            targetPath = draftPath;
            isDraft = true;
        } else if (!fs.existsSync(pubPath)) {
            return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404 });
        }

        const rawContent = fs.readFileSync(targetPath, 'utf-8');

        // Note: Instead of fully parsing frontmatter accurately which requires yaml, 
        // we'll just send the raw text to the editor so the user can see everything,
        // or parse the basics.
        // For simplicity, let's just extract content between --- and the rest
        const match = rawContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

        let frontmatterRaw = '';
        let bodyContent = rawContent;
        let title = '';
        let description = '';
        let cover = '';
        let tags: string[] = [];

        if (match) {
            frontmatterRaw = match[1];
            bodyContent = match[2];

            const titleMatch = frontmatterRaw.match(/title:\s*(.*)/);
            if (titleMatch) title = titleMatch[1].replace(/^["']|["']$/g, '');

            const descMatch = frontmatterRaw.match(/description:\s*(.*)/);
            if (descMatch) description = descMatch[1].replace(/^["']|["']$/g, '');

            const coverMatch = frontmatterRaw.match(/cover:\s*(.*)/);
            if (coverMatch) cover = coverMatch[1].replace(/^["']|["']$/g, '');

            // Parse tags
            const tagsMatch = frontmatterRaw.match(/tags:\s*\n((?:\s+-\s+.*\n?)*)/);
            if (tagsMatch) {
                const tagLines = tagsMatch[1].trim().split('\n');
                tags = tagLines.map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            id: slug,
            title,
            description,
            cover,
            tags,
            content: bodyContent,
            raw: rawContent,
            isDraft
        }), { status: 200 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
