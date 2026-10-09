import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.string().default('Alex Morgan, Video Technology Specialist'),
    readingTime: z.string().default('6 min read'),
    category: z.string(),
    tags: z.array(z.string()),
    featuredImage: z.string().default('/favicon.svg'),
    relatedPosts: z.array(z.string()).optional()
  })
});

export const collections = {
  blog: blogCollection
};
