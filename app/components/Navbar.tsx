"use client";
export default function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 flex flex-col">
      <nav className="bg-white max-w-full px-6 pt-1 pb-4 flex justify-between items-center relative z-10" style={{maxWidth:"100%"}}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center mt-4">
          <span className="text-lg font-bold tracking-tight text-gray-900">ETLIL</span>
          <ul className="flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
            {["About", "Projects", "Skills", "Contact"].map((s) => (
              <li key={s}>
                <a href={`#${s.toLowerCase()}`} className="hover:text-gray-900 transition-colors">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Ripped paper edge */}
      <div className="w-full relative z-0" style={{ height: "60px", marginTop: "-10px" }}>
        <img
          src="/ripped.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            display: "block",
          }}
        />
      </div>
    </header>
  );
}