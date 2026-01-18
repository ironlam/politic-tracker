"use client";

import { useState } from "react";
import Image from "next/image";

interface PoliticianAvatarProps {
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-xl",
  lg: "w-24 h-24 text-3xl",
};

export function PoliticianAvatar({
  photoUrl,
  firstName,
  lastName,
  size = "md",
  className = "",
}: PoliticianAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = `${firstName[0]}${lastName[0]}`;
  const sizeClass = sizeClasses[size];

  // Fallback to initials if no photo or image fails to load
  if (!photoUrl || imageError) {
    return (
      <div
        className={`rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 flex-shrink-0 ${sizeClass} ${className}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`relative rounded-full overflow-hidden flex-shrink-0 ${sizeClass} ${className}`}>
      <Image
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
        unoptimized // External images from AN
      />
    </div>
  );
}
