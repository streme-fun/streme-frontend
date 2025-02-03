import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

export function Navbar() {
  const { login, logout, authenticated } = usePrivy();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 sm:px-20 h-20 bg-background/80 backdrop-blur-sm border-b border-black/[.1] dark:border-white/[.1]">
      <Link href="/" className="flex items-center">
        <Image
          className=""
          src="/stremefun.svg"
          alt="Stremefun logo"
          width={180}
          height={38}
          priority
        />
      </Link>
      <div className="flex items-center gap-6">
        <Link href="/launch" className="btn btn-primary ">
          <Image
            src="/special-e.svg"
            alt="Launch Token"
            width={8}
            height={8}
            priority
          />
          Launch a Token
        </Link>
        {/* <Link href="/about" className="text-sm btn btn-ghost">
          About
        </Link> */}
        {authenticated ? (
          <button onClick={logout} className="btn btn-ghost">
            Logout
          </button>
        ) : (
          <button onClick={login} className="btn btn-ghost">
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
