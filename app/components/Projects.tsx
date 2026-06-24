const projects = [
  {
    title: "Project Alpha",
    description:
      "A full-stack web application built with Next.js and TypeScript. Features user authentication, real-time updates, and a responsive dashboard.",
    tech: ["Next.js", "TypeScript", "PostgreSQL"],
    link: "#",
    repo: "#",
  },
  {
    title: "Project Beta",
    description:
      "An e-commerce platform with cart management, payment integration, and admin panel built with React and Node.js.",
    tech: ["React", "Node.js", "Tailwind CSS"],
    link: "#",
    repo: "#",
  },
  {
    title: "Project Gamma",
    description:
      "A data visualization dashboard that aggregates analytics and presents insights through interactive charts and filters.",
    tech: ["React", "D3.js", "REST API"],
    link: "#",
    repo: "#",
  },
];

export default function Projects() {
  return (
    <section id="projects" className="min-h-screen flex items-center pt-20">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">Work</p>
        <h2 className="text-4xl font-bold text-gray-900 mb-16">Selected Projects</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {projects.map((p) => (
            <div key={p.title} className="bg-white border border-gray-200 p-8 flex flex-col justify-between group">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{p.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">{p.description}</p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {p.tech.map((t) => (
                    <span key={t} className="text-xs uppercase tracking-wider border border-gray-300 text-gray-500 px-3 py-1">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <a href={p.link} className="text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-gray-500 transition-colors">
                  Live Demo
                </a>
                <a href={p.repo} className="text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-gray-500 transition-colors">
                  GitHub
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}