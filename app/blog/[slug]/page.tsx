import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { blogPosts, getBlogPostBySlug } from '../../../data/blogPosts';
import BlogPost from '../../../components/BlogPost';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) {
    return { title: 'Post Not Found | Nexli Blog' };
  }

  const ogImage = post.src.startsWith('http') ? post.src : `https://www.nexli.net${post.src}`;
  const description = post.excerpt.length > 160 ? post.excerpt.substring(0, 157) + '...' : post.excerpt;

  return {
    title: `${post.title} | Nexli Blog`,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: `${post.title} | Nexli Blog`,
      description,
      images: [{ url: ogImage }],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  return <BlogPost slug={slug} />;
}
