/**
 * @file src/app/components/LandingFooter.tsx
 * @description 랜딩페이지 하단 푸터 - 저작권 및 시스템 정보
 */

import { Factory } from "lucide-react";
import Link from "next/link";

const footerLinks = [
  { label: "대시보드", href: "/dashboard" },
  { label: "로그인", href: "/login" },
  { label: "개인정보처리방침", href: "#" },
  { label: "문의하기", href: "#" },
];

export default function LandingFooter() {
  return (
    <footer className="py-10 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/20 rounded-md flex items-center justify-center">
              <Factory className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-text">HARNESS MES</span>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs text-text-muted hover:text-text transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} HARNESS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
