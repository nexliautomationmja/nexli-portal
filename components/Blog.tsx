'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useBooking } from './QualificationProvider';
import { SparklesCore } from './Sparkles';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { blogPosts } from '../data/blogPosts';

const Blog: React.FC = () => {
    const router = useRouter();
  const { theme } = useTheme();
  const { openBooking } = useBooking();
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScrollability = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  React.useEffect(() => {
    checkScrollability();
  }, []);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] md:min-h-[70vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Sparkles Background for Dark Mode */}
        {theme === 'dark' && (
          <div className="absolute inset-0 w-full h-full">
            <SparklesCore
              id="blog-sparkles"
              background="transparent"
              minSize={0.6}
              maxSize={1.4}
              particleCount={100}
              particleColor="#FFFFFF"
              speed={0.8}
              className="w-full h-full"
            />
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-main)] pointer-events-none z-10" />

        <div className="relative z-20 max-w-5xl mx-auto text-center px-6 pt-32 md:pt-24">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-block mb-6 md:mb-8"
          >
            <div className={`relative inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest overflow-hidden ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>
              {/* Shimmer border effect */}
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <span
                  className="absolute inset-[-100%] animate-[shimmer_3s_linear_infinite]"
                  style={{
                    background: theme === 'dark'
                      ? 'conic-gradient(from 90deg at 50% 50%, #3b82f6 0%, transparent 50%, transparent 75%, #06b6d4 100%)'
                      : 'conic-gradient(from 90deg at 50% 50%, #2563eb 0%, transparent 50%, transparent 75%, #0891b2 100%)'
                  }}
                />
              </span>
              <span className={`absolute inset-[1.5px] rounded-full ${
                theme === 'dark' ? 'bg-[#020617]' : 'bg-white'
              }`} />
              <span className="relative z-10">Insights & Resources</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className={`text-3xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 md:mb-8 leading-[1.15] md:leading-[1.1] ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            The Nexli{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
              Blog
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`text-base md:text-xl leading-relaxed max-w-2xl mx-auto mb-8 ${
              theme === 'dark' ? 'text-neutral-400' : 'text-slate-600'
            }`}
          >
            Strategies, insights, and best practices for established CPA firms ready to elevate their practice with modern technology.
          </motion.p>
        </div>
      </section>

      {/* Cards Carousel Section */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="pl-4 md:pl-8 text-xl md:text-4xl font-bold text-[var(--text-main)] mb-4"
          >
            Latest Articles
          </motion.h2>

          {/* Carousel */}
          <div className="relative w-full">
            <div
              className="flex w-full overflow-x-scroll overscroll-x-auto py-10 md:py-20 scroll-smooth [scrollbar-width:none]"
              ref={carouselRef}
              onScroll={checkScrollability}
            >
              <div className="flex flex-row justify-start gap-4 pl-4 max-w-7xl mx-auto">
                {blogPosts.map((post, index) => (
                  <motion.div
                    key={post.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.5,
                        delay: 0.2 * index,
                        ease: "easeOut",
                      },
                    }}
                    className="last:pr-[5%] md:last:pr-[33%] rounded-3xl"
                  >
                    <button
                      onClick={() => router.push(`/blog/${post.slug}`)}
                      className="rounded-3xl bg-[var(--glass-bg)] dark:bg-[#0f0f0f] border border-[var(--glass-border)] h-48 w-72 md:h-80 md:w-[28rem] overflow-hidden flex flex-col items-start justify-end relative z-10 hover:scale-[1.02] transition-transform text-left"
                    >
                      <div className="absolute h-full bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-30 pointer-events-none" />
                      <div className="relative z-40 p-4 md:p-5">
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest text-left">
                          {post.category}
                        </p>
                        <p className="text-white text-sm md:text-base font-bold max-w-xs text-left [text-wrap:balance] mt-1">
                          {post.title}
                        </p>
                      </div>
                      <img
                        src={post.src}
                        alt={post.title}
                        className="object-cover absolute z-10 inset-0 w-full h-full"
                        style={post.imagePosition ? { objectPosition: post.imagePosition } : undefined}
                        loading="lazy"
                      />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mr-10">
              <button
                className="relative z-40 h-10 w-10 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center disabled:opacity-50 hover:bg-blue-500/10 transition-colors"
                onClick={scrollLeft}
                disabled={!canScrollLeft}
              >
                <ChevronLeft className="h-6 w-6 text-[var(--text-muted)]" />
              </button>
              <button
                className="relative z-40 h-10 w-10 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center disabled:opacity-50 hover:bg-blue-500/10 transition-colors"
                onClick={scrollRight}
                disabled={!canScrollRight}
              >
                <ChevronRight className="h-6 w-6 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 md:px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto p-6 md:p-16 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />

          <div className="relative z-10 text-center">
            <h2 className="text-xl md:text-4xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
              Ready to Transform Your Practice?
            </h2>
            <p className="text-sm md:text-lg text-[var(--text-muted)] mb-6 md:mb-10 max-w-2xl mx-auto">
              Stop reading about success and start experiencing it. Book a consultation to see how Nexli can help you serve more clients and reclaim your time.
            </p>
            <button
              onClick={openBooking}
              className="inline-flex items-center gap-2 md:gap-3 bg-blue-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-full text-sm md:text-lg font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-xl shadow-blue-600/25 active:scale-95 group"
            >
              Book a Consultation
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default Blog;
