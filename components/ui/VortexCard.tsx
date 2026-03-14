'use client';
"use client";
import React from "react";
import { Vortex } from "../Vortex";

export const VortexCard: React.FC = () => {
  return (
    <div className="w-full h-full overflow-hidden rounded-lg bg-black">
      <Vortex
        backgroundColor="black"
        baseHue={217}
        particleCount={200}
        rangeY={30}
        baseRadius={0.8}
        rangeRadius={1.5}
        containerClassName="w-full h-full"
        className="flex items-center justify-center w-full h-full"
      >
        <div className="flex flex-col items-center justify-center text-center">
          <h2 className="text-white text-base font-bold">
            Web Design
          </h2>
          <p className="text-white text-[9px] mt-0.5 opacity-70">
            Premium websites
          </p>
        </div>
      </Vortex>
    </div>
  );
};

export default VortexCard;
