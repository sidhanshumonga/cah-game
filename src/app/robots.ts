import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cah-game.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/store', '/privacy', '/terms', '/howto'],
        disallow: [
          '/admin',
          '/admin/',
          '/coins',
          '/coins/',
          '/create',
          '/create/',
          '/end',
          '/end/',
          '/game/',
          '/lobby/',
          '/login',
          '/login/',
          '/profile',
          '/profile/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
