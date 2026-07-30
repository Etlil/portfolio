"use client";

import { useState, type CSSProperties } from "react";
import SectionSky from "./SectionSky";

const EMAIL = "jezreelpimentel@gmail.com";
const LINKEDIN_URL = "https://www.linkedin.com/in/jezreel-pimentel-9394a9317";
const FACEBOOK_URL = "https://www.facebook.com/etlilhshshhs/";

/* Web3Forms access key — delivers the form straight to your Gmail (no server,
   no password). Safe to expose: it only sends to your verified inbox and is
   rate-limited. Not domain-locked, so it works on localhost and Vercel alike. */
const WEB3FORMS_ACCESS_KEY = "0f5113ec-3828-4f0e-a013-0ac6d22bc7dd";

const socials = [
  { file: "linkedin", label: "LinkedIn", href: LINKEDIN_URL },
  { file: "facebook", label: "Facebook", href: FACEBOOK_URL },
];

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Fallback until a real key is set: hand off to the visitor's mail app.
    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.startsWith("YOUR_")) {
      const subject = encodeURIComponent(`Portfolio inquiry from ${name || "someone"}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
      window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: `Portfolio inquiry from ${name || "someone"}`,
          from_name: name || "Portfolio visitor",
          name,
          email,
          message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("sent");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  // Smooth-scroll to the top via Lenis (matches the rest of the site), with a
  // native fallback if Lenis isn't mounted.
  const scrollToTop = () => {
    const lenis = (window as unknown as {
      __lenis?: { scrollTo: (target: number, opts?: { duration?: number }) => void };
    }).__lenis;
    if (lenis) lenis.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // contact-ink = var(--ink) — the same pencil grey as the rest of the site.
  const inputClass =
    "contact-ink relative z-10 w-full px-4 py-3 text-sm bg-transparent border-0 " +
    "focus:outline-none focus:bg-black/[0.04] transition-colors";

  // White, paper-textured chip with a torn black outline — the same look as the
  // Skills hover labels (via the #field-tear displacement filter). Lives behind
  // the field so the text/label on top stays crisp.
  const fieldBacking: CSSProperties = {
    zIndex: 0,
    backgroundColor: "var(--field-paper)",
    backgroundImage: "url('/paper.svg')",
    backgroundRepeat: "repeat",
    backgroundSize: "150px 150px",
    border: "2px solid var(--ink-line)",
    filter: "url(#field-tear)",
  };

  return (
    <section
      id="contact"
      className="relative flex flex-col justify-center"
      style={{ minHeight: "100vh", padding: "clamp(5.5rem, 10vh, 7rem) 6% 2rem" }}
    >
      <SectionSky seed={4} fireflies={18} />
      {/* Torn-paper edge for the form card — a milder version of the Skills
          cards' #card-tear (shallower, finer tears). */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="contact-tear" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.019 0.022" numOctaves="3" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Finer, shallower tears for the small field outlines — matches the
              Skills hover-label edge. */}
          <filter id="field-tear" x="-6%" y="-16%" width="112%" height="132%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="4" seed="9" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="w-full mx-auto" style={{ maxWidth: "1100px" }}>
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left — pitch, details, socials */}
          <div>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">Get In Touch</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Let&apos;s Work Together
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8" style={{ maxWidth: "44ch" }}>
              I&apos;m currently open to new opportunities — a project, a role, or just a
              conversation. My inbox is always open.
            </p>

            <div className="space-y-3 mb-10 text-sm">
              <a href={`mailto:${EMAIL}`} className="flex items-center gap-4 w-fit group">
                <span className="uppercase tracking-wider text-xs text-gray-400 w-16">Email</span>
                <span className="text-gray-800 group-hover:underline underline-offset-4">{EMAIL}</span>
              </a>
              <div className="flex items-center gap-4">
                <span className="uppercase tracking-wider text-xs text-gray-400 w-16">Where</span>
                <span className="text-gray-800">San Luis, Aurora</span>
              </div>
            </div>

            <div className="flex items-center gap-5">
              {socials.map((s) => {
                const mail = s.href.startsWith("mailto:");
                return (
                  <a
                    key={s.file}
                    href={s.href}
                    aria-label={s.label}
                    title={s.label}
                    {...(mail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                    className="block transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-110 hover:-rotate-3"
                  >
                    <img
                      src={`/${s.file}.png`}
                      alt={s.label}
                      width={56}
                      height={56}
                      className="w-14 h-14 object-contain"
                      style={{ filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.18))" }}
                      draggable={false}
                    />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Right — the note (a sheet of paper on the desk) */}
          <form onSubmit={handleSubmit} className="relative" style={{ padding: "2.4rem 2.2rem" }}>
            {/* Torn-paper backing — colour, texture and ragged edge live here so
                the fields on the layer above stay crisp (same trick as the cards). */}
            <div
              aria-hidden
              className="form-paper absolute inset-0"
              style={{
                zIndex: 0,
                backgroundColor: "var(--form-paper)",
                backgroundImage: "url('/paper.svg')",
                backgroundRepeat: "repeat",
                backgroundSize: "320px 320px",
                filter:
                  "url(#contact-tear) drop-shadow(0 6px 14px rgba(0,0,0,0.14)) drop-shadow(0 20px 36px rgba(0,0,0,0.2))",
              }}
            />
            <div className="relative space-y-4" style={{ zIndex: 1 }}>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Name</label>
                <div className="relative">
                  <div aria-hidden className="field-paper absolute inset-0" style={fieldBacking} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Email</label>
                <div className="relative">
                  <div aria-hidden className="field-paper absolute inset-0" style={fieldBacking} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Message</label>
                <div className="relative">
                  <div aria-hidden className="field-paper absolute inset-0" style={fieldBacking} />
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell me about your project or opportunity…"
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={status === "sending"}
                className="contact-ink relative block w-full text-sm font-semibold uppercase tracking-widest transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ padding: "0.95rem" }}
              >
                <span
                  aria-hidden
                  className="field-paper absolute inset-0"
                  style={{ ...fieldBacking, filter: "url(#field-tear) drop-shadow(0 5px 10px rgba(0,0,0,0.18))" }}
                />
                <span className="relative z-10">
                  {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : "Send Message"}
                </span>
              </button>

              {status === "sent" && (
                <p className="relative z-10 text-center text-xs tracking-wide text-green-700">
                  Thanks — your message is on its way to my inbox.
                </p>
              )}
              {status === "error" && (
                <p className="relative z-10 text-center text-xs tracking-wide text-red-700">
                  Something went wrong. Please email me directly at {EMAIL}.
                </p>
              )}
            </div>
          </form>
        </div>

        <div
          className="mt-6 pt-4 text-center"
          style={{ borderTop: "1px solid var(--rule)" }}
        >
          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-2 text-xs uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span className="transition-transform group-hover:-translate-y-0.5">↑</span>
            Back to top
          </button>
        </div>
      </div>
    </section>
  );
}
