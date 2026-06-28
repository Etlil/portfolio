import Navbar from "./components/Navbar";
import About from "./components/About";
import PlaneTransition from "./components/PlaneTransition";
import Projects from "./components/Projects";
import Skills from "./components/Skills";
import Contact from "./components/Contact";

export default function Home() {
  return (
    <main>
      <Navbar />
      <div id="main-content">
        <About />
        <PlaneTransition />
        <Projects />
        <Skills />
        <Contact />
      </div>
    </main>
  );
}