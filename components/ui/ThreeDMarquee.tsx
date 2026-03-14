'use client';
"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import React from "react";

type MarqueeItem = string | React.ReactNode;

export const ThreeDMarquee = ({
  images,
  className,
}: {
  images: MarqueeItem[];
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "w-full h-full overflow-hidden rounded-2xl bg-neutral-900",
        className,
      )}
    >
      <div className="flex gap-3 h-full p-3">
        {/* Column 1 */}
        <div className="flex-1 overflow-hidden">
          <motion.div
            animate={{ y: ["0%", "-50%"] }}
            transition={{
              duration: 60,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex flex-col gap-3"
          >
            {[...images.slice(0, 6), ...images.slice(0, 6)].map((item, idx) => (
              <div
                key={idx}
                className="w-full h-32 rounded-lg overflow-hidden flex-shrink-0 bg-black"
              >
                {typeof item === "string" ? (
                  <img
                    src={item}
                    alt={`Showcase ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full">{item}</div>
                )}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Column 2 */}
        <div className="flex-1 overflow-hidden">
          <motion.div
            animate={{ y: ["-50%", "0%"] }}
            transition={{
              duration: 70,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex flex-col gap-3"
          >
            {[...images.slice(6), ...images.slice(6)].map((item, idx) => (
              <div
                key={idx}
                className="w-full h-32 rounded-lg overflow-hidden flex-shrink-0 bg-black"
              >
                {typeof item === "string" ? (
                  <img
                    src={item}
                    alt={`Showcase ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full">{item}</div>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ThreeDMarquee;
