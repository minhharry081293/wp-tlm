"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconGlobe, IconList, IconUnlink, IconUpload, IconUsers } from "./icons";

const NAV = [
  { href: "/", label: "Sites", icon: IconGlobe },
  { href: "/place", label: "Đặt textlink", icon: IconUpload },
  { href: "/remove", label: "Gỡ theo URL", icon: IconUnlink },
  { href: "/jobs", label: "Jobs", icon: IconList },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMe(data?.user || null))
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 border-r border-stone-200 pr-6">
      <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col">
        <Link href="/" className="flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-sm font-bold text-white shadow-sm shadow-teal-900/20">
            T
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-700">
              TLM
            </p>
            <h1 className="text-sm font-semibold text-stone-900">
              Textlink Manager
            </h1>
          </div>
        </Link>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-teal-800 shadow-sm ring-1 ring-stone-200"
                    : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${
                    active
                      ? "text-teal-700"
                      : "text-stone-400 group-hover:text-stone-600"
                  }`}
                />
                {label}
              </Link>
            );
          })}
          {me?.role === "admin" && (
            <Link
              href="/users"
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                pathname === "/users"
                  ? "bg-white text-teal-800 shadow-sm ring-1 ring-stone-200"
                  : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
              }`}
            >
              <IconUsers
                className={`h-[18px] w-[18px] shrink-0 ${
                  pathname === "/users" ? "text-teal-700" : "text-stone-400 group-hover:text-stone-600"
                }`}
              />
              Users
            </Link>
          )}
        </nav>

        <div className="mt-auto rounded-xl bg-white/60 px-3 py-3 text-xs leading-relaxed text-stone-500 ring-1 ring-stone-200/70">
          <div className="font-medium text-stone-800">{me?.username || "…"}</div>
          <div className="mb-2 text-stone-400">{me?.role === "admin" ? "Admin" : "User"}</div>
          <button type="button" onClick={logout} className="font-medium text-teal-700 hover:underline">
            Đăng xuất
          </button>
        </div>
      </div>
    </aside>
  );
}
