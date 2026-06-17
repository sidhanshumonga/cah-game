import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cah-game.vercel.app';
  
  const routes = ['', '/store', '/privacy', '/terms'];
  
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/store' ? 'daily' : 'monthly',
    priority: route === '' ? 1.0 : route === '/store' ? 0.8 : 0.5,
  }));
}
