export default function About() {
  return (
    <section id="about" className="min-h-screen flex items-center pt-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">About Me</p>
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            Your Name
          </h1>
          <p className="text-xl text-gray-500 font-medium mb-6">
            Frontend Developer · React · Next.js · TypeScript
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            A results-driven frontend developer with a passion for building clean,
            accessible, and performant web applications. Experienced in collaborating
            with cross-functional teams to deliver high-quality digital products from
            concept to deployment.
          </p>
          <div className="flex gap-4">
            <a
              href="#contact"
              className="px-6 py-3 bg-gray-900 text-white text-sm font-medium uppercase tracking-widest hover:bg-gray-700 transition-colors"
            >
              Hire Me
            </a>
            <a
              href="/resume.pdf"
              target="_blank"
              className="px-6 py-3 border border-gray-900 text-gray-900 text-sm font-medium uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              Resume
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[
            { label: "Years Experience", value: "3+" },
            { label: "Projects Completed", value: "20+" },
            { label: "Technologies", value: "15+" },
            { label: "Available", value: "Now" },
          ].map((stat) => (
            <div key={stat.label} className="border border-gray-200 p-6">
              <p className="text-4xl font-bold text-gray-900 mb-2">{stat.value}</p>
              <p className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}