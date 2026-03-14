'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { Home, ArrowLeft, Search } from 'lucide-react';

const NotFound: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* 404 Number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <span className="text-[120px] md:text-[180px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
            404
          </span>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className={`text-2xl md:text-4xl font-bold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Page Not Found
          </h1>
          <p className={`text-base md:text-lg mb-8 max-w-md mx-auto ${
            theme === 'dark' ? 'text-neutral-400' : 'text-slate-600'
          }`}>
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-lg shadow-blue-600/25"
          >
            <Home size={18} />
            Go Home
          </button>
          <button
            onClick={() => router.back()}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all border ${
              theme === 'dark'
                ? 'border-white/20 text-white hover:bg-white/10'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft size={18} />
            Go Back
          </button>
        </motion.div>

        {/* Helpful links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={`mt-12 pt-8 border-t ${
            theme === 'dark' ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <p className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-neutral-500' : 'text-slate-500'
          }`}>
            Here are some helpful links:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <button
              onClick={() => router.push('/')}
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              Home
            </button>
            <span className={theme === 'dark' ? 'text-neutral-600' : 'text-slate-300'}>•</span>
            <a
              href="/services"
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              Services
            </a>
            <span className={theme === 'dark' ? 'text-neutral-600' : 'text-slate-300'}>•</span>
            <a
              href="/blog"
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              Blog
            </a>
            <span className={theme === 'dark' ? 'text-neutral-600' : 'text-slate-300'}>•</span>
            <a
              href="/free-guide"
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              Free Guide
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
