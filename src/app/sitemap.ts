import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cah-game.vercel.app';
  
  const routes = ['', '/store', '/privacy', '/terms', '/howto', '/feedback'];
  
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/store' || route === '/howto' || route === '/feedback' ? 'daily' : 'monthly',
    priority: route === '' ? 1.0 : route === '/store' || route === '/feedback' ? 0.8 : route === '/howto' ? 0.7 : 0.5,
  }));
}
