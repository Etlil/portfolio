"use client";
export default function Navbar() {
  return (
    <header className="fixed top-0 w-full bg-white border-b border-gray-200 z-50">
      <nav className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <span className="text-lg font-bold tracking-tight text-gray-900">YN.</span>
        <ul className="flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
          {["About", "Projects", "Skills", "Contact"].map((s) => (
            <li key={s}>
              <a href={`#${s.toLowerCase()}`} className="hover:text-gray-900 transition-colors">
                {s}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}