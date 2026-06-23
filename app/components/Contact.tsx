export default function Contact() {
  return (
    <section id="contact" className="bg-gray-900 text-white py-24">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-start">
        <div>
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">Get In Touch</p>
          <h2 className="text-4xl font-bold mb-6">Let's Work Together</h2>
          <p className="text-gray-400 leading-relaxed mb-8">
            I'm currently open to new opportunities. Whether you have a project in mind,
            a role to fill, or just want to connect — my inbox is always open.
          </p>
          <div className="space-y-4 text-sm">
            <p className="text-gray-300">
              <span className="text-gray-500 uppercase tracking-wider mr-3">Email</span>
              yourname@email.com
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500 uppercase tracking-wider mr-3">Location</span>
              Baguio City, Philippines
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500 uppercase tracking-wider mr-3">LinkedIn</span>
              linkedin.com/in/yourname
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500 uppercase tracking-wider mr-3">GitHub</span>
              github.com/yourname
            </p>
          </div>
        </div>
        <form className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Name</label>
            <input
              type="text"
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-gray-400 transition-colors"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Email</label>
            <input
              type="email"
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-gray-400 transition-colors"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Message</label>
            <textarea
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-gray-400 transition-colors resize-none"
              placeholder="Tell me about your project or opportunity..."
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-white text-gray-900 text-sm font-semibold uppercase tracking-widest hover:bg-gray-200 transition-colors"
          >
            Send Message
          </button>
        </form>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-16 pt-8 border-t border-gray-800 text-center text-xs text-gray-600 uppercase tracking-widest">
        © {new Date().getFullYear()} Your Name. All rights reserved.
      </div>
    </section>
  );
}