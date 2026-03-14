'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useBooking } from './QualificationProvider';
import { ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react';
import { BlogPost as BlogPostType, getBlogPostBySlug, blogPosts } from '../data/blogPosts';

const BlogPost: React.FC<{ slug: string }> = ({ slug }) => {
    const router = useRouter();
  const { theme } = useTheme();
  const { openBooking } = useBooking();
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-4">Post not found</h1>
          <button
            onClick={() => router.push('/blog')}
            className="text-blue-500 hover:text-blue-400 font-semibold"
          >
            Back to Blog
          </button>
        </div>
      </div>
    );
  }

  // Find next and previous posts for navigation
  const currentIndex = blogPosts.findIndex(p => p.slug === slug);
  const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <img
          src={post.src}
          alt={post.title}
          className="w-full h-full object-cover"
          style={post.imagePosition ? { objectPosition: post.imagePosition } : undefined}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/60 to-transparent" />

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push('/blog')}
          className="absolute top-24 md:top-32 left-6 md:left-12 z-50 flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Back to Blog</span>
        </motion.button>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-4xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block text-blue-400 text-sm font-bold uppercase tracking-widest mb-4"
            >
              {post.category}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight"
            >
              {post.title}
            </motion.h1>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Excerpt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <p className="text-lg md:text-2xl text-[var(--text-main)] font-medium leading-relaxed">
            {post.excerpt}
          </p>
        </motion.div>

        {/* Divider */}
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mb-12" />

        {/* Sections */}
        <div className="space-y-12">
          {post.sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] mb-4">
                {section.heading}
              </h2>
              <p className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed">
                {section.content}
              </p>
              {section.image && (
                <img
                  src={section.image}
                  alt={section.heading}
                  className="mt-8 rounded-2xl w-full object-cover"
                  loading="lazy"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16 p-8 md:p-12 rounded-3xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-center"
        >
          <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-4">
            Ready to Transform Your Practice?
          </h3>
          <p className="text-[var(--text-muted)] mb-6 max-w-xl mx-auto">
            See how Nexli can help you implement these strategies and grow your firm.
          </p>
          <button
            onClick={openBooking}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-lg shadow-blue-600/25"
          >
            Book a Consultation
            <ArrowRight size={18} />
          </button>
        </motion.div>

        {/* Post Navigation */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4">
          {prevPost && (
            <button
              onClick={() => router.push(`/blog/${prevPost.slug}`)}
              className="group p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-left hover:border-blue-500/30 transition-all"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2 mb-2">
                <ArrowLeft size={14} />
                Previous
              </span>
              <span className="text-[var(--text-main)] font-semibold group-hover:text-blue-500 transition-colors line-clamp-2">
                {prevPost.title}
              </span>
            </button>
          )}
          {nextPost && (
            <button
              onClick={() => router.push(`/blog/${nextPost.slug}`)}
              className="group p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-right hover:border-blue-500/30 transition-all md:col-start-2"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center justify-end gap-2 mb-2">
                Next
                <ArrowRight size={14} />
              </span>
              <span className="text-[var(--text-main)] font-semibold group-hover:text-blue-500 transition-colors line-clamp-2">
                {nextPost.title}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogPost;
