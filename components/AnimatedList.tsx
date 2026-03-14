'use client';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedListProps {
  children: React.ReactNode[];
  delay?: number;
  maxVisible?: number;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  delay = 2000,
  maxVisible = 5
}) => {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;

        // Add new item to visible list
        setVisibleItems((items) => {
          const newItems = [...items, nextIndex % children.length];
          if (newItems.length > maxVisible) {
            return newItems.slice(-maxVisible);
          }
          return newItems;
        });

        return nextIndex;
      });
    }, delay);

    // Show first item immediately
    setVisibleItems([0]);

    return () => clearInterval(interval);
  }, [children.length, delay, maxVisible]);

  return (
    <div className="flex flex-col gap-3 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {visibleItems.map((itemIndex, i) => (
          <motion.div
            key={`${itemIndex}-${i}`}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 25,
            }}
            layout
          >
            {children[itemIndex]}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AnimatedList;
