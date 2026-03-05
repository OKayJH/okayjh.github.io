export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
    // Only allow in development mode
    if (import.meta.env.PROD) {
        return new Response(JSON.stringify({ error: 'Endpoint only available in dev mode' }), { status: 403 });
    }

    try {
        const body = await request.json();
        const { slug: rawSlug, title, content, date, description, tags, cover, isDraft, isEdit } = body;

        if (!title || !content) {
            return new Response(JSON.stringify({ error: 'Missing required fields (title and content)' }), { status: 400 });
        }

        // Auto-generate slug from title if not provided
        let slug = rawSlug;
        if (!slug) {
            // Create a slug: use ASCII chars from title, fallback to timestamp
            slug = title
                .toLowerCase()
                .replace(/[^\w\s-]/g, '') // remove non-word chars (Chinese chars removed)
                .replace(/\s+/g, '-')     // spaces to hyphens
                .replace(/-+/g, '-')      // collapse hyphens
                .trim();
            if (!slug || slug === '-') {
                slug = `post-${Date.now()}`;
            }
        }

        const projectRoot = process.cwd();

        // If it's a draft edit of an existing article, we save it with a '-draft' suffix temporarily.
        // If it's pure publish, we save normally.
        let finalSlug = slug;
        if (isDraft && isEdit) {
            finalSlug = `${slug}-draft`;
        }

        const filePath = path.join(projectRoot, 'src', 'content', 'blog', `${finalSlug}.md`);

        // Construct frontmatter
        let tagsString = Array.isArray(tags) ? `\n  - ${tags.join('\n  - ')}` : '';
        if (tagsString === '') tagsString = '\n  - 技术'; // default tag

        // Get local YYYY-MM-DD date using timezone offset
        const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

        const fileContent = `---
title: ${JSON.stringify(title)}
date: ${date || localDate}
description: ${JSON.stringify(description || '')}
tags:${tagsString}
cover: ${JSON.stringify(cover || '')}
draft: ${isDraft ? 'true' : 'false'}
---
${content}`;

        fs.writeFileSync(filePath, fileContent, 'utf-8');

        return new Response(JSON.stringify({
            success: true,
            message: 'Saved successfully',
            slug: finalSlug
        }), { status: 200 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
