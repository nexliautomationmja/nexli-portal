'use client';
import React, { useEffect, useRef, useState, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselProps {
  items: React.ReactElement[];
  initialScroll?: number;
}

type Card = {
  src: string;
  title: string;
  category: string;
  content: React.ReactNode;
};

export const CarouselContext = createContext<{
  onCardClose: (index: number) => void;
  currentIndex: number;
}>({
  onCardClose: () => {},
  currentIndex: 0,
});

export const Carousel = ({ items, initialScroll = 0 }: CarouselProps) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = initialScroll;
      checkScrollability();
    }
  }, [initialScroll]);

  const checkScrollability = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

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

  const handleCardClose = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = isMobile() ? 230 : 384;
      const gap = isMobile() ? 16 : 32;
      const scrollPosition = (cardWidth + gap) * (index + 1);
      carouselRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
      setCurrentIndex(index);
    }
  };

  const isMobile = () => {
    return window && window.innerWidth < 768;
  };

  return (
    <CarouselContext.Provider value={{ onCardClose: handleCardClose, currentIndex }}>
      <div className="relative w-full">
        <div
          className="flex w-full overflow-x-scroll overscroll-x-auto py-10 md:py-20 scroll-smooth [scrollbar-width:none]"
          ref={carouselRef}
          onScroll={checkScrollability}
        >
          <div className="absolute right-0 z-[1000] h-auto w-[5%] overflow-hidden bg-gradient-to-l" />
          <div className="flex flex-row justify-start gap-4 pl-4 max-w-7xl mx-auto">
            {items.map((item, index) => (
              <motion.div
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
                key={"card" + index}
                className="last:pr-[5%] md:last:pr-[33%] rounded-3xl"
              >
                {item}
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
    </CarouselContext.Provider>
  );
};

export const Card = ({
  card,
  index,
  layout = false,
}: {
  card: Card;
  index: number;
  layout?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { onCardClose } = useContext(CarouselContext);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    onCardClose(index);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 h-screen z-50 overflow-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black/80 backdrop-blur-lg h-full w-full fixed inset-0"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={containerRef}
              layoutId={layout ? `card-${card.title}` : undefined}
              className="max-w-5xl mx-auto bg-[var(--bg-main)] dark:bg-[#0a0a0a] h-fit z-[60] my-10 p-4 md:p-10 rounded-3xl font-sans relative border border-[var(--glass-border)]"
            >
              <button
                className="sticky top-4 h-8 w-8 right-0 ml-auto bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full flex items-center justify-center hover:bg-blue-500/10 transition-colors"
                onClick={handleClose}
              >
                <X className="h-5 w-5 text-[var(--text-muted)]" />
              </button>
              <motion.p
                layoutId={layout ? `category-${card.title}` : undefined}
                className="text-blue-500 text-sm md:text-base font-bold uppercase tracking-widest"
              >
                {card.category}
              </motion.p>
              <motion.p
                layoutId={layout ? `title-${card.title}` : undefined}
                className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mt-4"
              >
                {card.title}
              </motion.p>
              <div className="py-10">{card.content}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <motion.button
        layoutId={layout ? `card-${card.title}` : undefined}
        onClick={handleOpen}
        className="rounded-3xl bg-[var(--glass-bg)] dark:bg-[#0f0f0f] border border-[var(--glass-border)] h-80 w-56 md:h-[40rem] md:w-96 overflow-hidden flex flex-col items-start justify-start relative z-10 hover:scale-[1.02] transition-transform"
      >
        <div className="absolute h-full top-0 inset-x-0 bg-gradient-to-b from-black/50 via-transparent to-transparent z-30 pointer-events-none" />
        <div className="relative z-40 p-8">
          <motion.p
            layoutId={layout ? `category-${card.category}` : undefined}
            className="text-blue-400 text-sm md:text-base font-bold uppercase tracking-widest text-left"
          >
            {card.category}
          </motion.p>
          <motion.p
            layoutId={layout ? `title-${card.title}` : undefined}
            className="text-white text-xl md:text-3xl font-bold max-w-xs text-left [text-wrap:balance] mt-2"
          >
            {card.title}
          </motion.p>
        </div>
        <img
          src={card.src}
          alt={card.title}
          className="object-cover absolute z-10 inset-0 w-full h-full"
          loading="lazy"
        />
      </motion.button>
    </>
  );
};
