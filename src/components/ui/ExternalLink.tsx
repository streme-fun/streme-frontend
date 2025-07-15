"use client";

import { useNavigation } from "@/src/hooks/useNavigation";

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function ExternalLink({ href, children, className, title, onClick }: ExternalLinkProps) {
  const { openExternalUrl } = useNavigation();

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    if (onClick) {
      onClick(e);
    }
    
    await openExternalUrl(href);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      title={title}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}