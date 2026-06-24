const skills = [
  {
    category: "Frontend",
    items: ["React", "Next.js", "TypeScript", "Tailwind CSS", "HTML5", "CSS3"],
  },
  {
    category: "Tools & Platforms",
    items: ["Git", "GitHub", "Vercel", "Figma", "VS Code", "Postman"],
  },
  {
    category: "Backend & Other",
    items: ["Node.js", "REST APIs", "PostgreSQL", "Firebase", "Jest", "Agile/Scrum"],
  },
];

export default function Skills() {
  return (
    <section id="skills" className="min-h-screen flex items-center pt-20">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">Expertise</p>
        <h2 className="text-4xl font-bold text-gray-900 mb-16">Skills & Technologies</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {skills.map((group) => (
            <div key={group.category} className="border border-gray-200 p-8">
              <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-6 font-semibold">
                {group.category}
              </h3>
              <ul className="space-y-3">
                {group.items.map((skill) => (
                  <li key={skill} className="flex items-center gap-3 text-gray-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}