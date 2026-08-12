// src/GuestPage.jsx
import React from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Globe,
  Lightbulb,
  Mail,
  Phone,
  ShieldCheck,
  Target,
} from "lucide-react";

const solutions = [
  {
    icon: BookOpen,
    title: "Learning Management System",
    text: "Centralize curriculum, assignments, and communication in one connected learning workspace.",
  },
  {
    icon: Lightbulb,
    title: "AI-Ready Question Papers",
    text: "Create customized assessments from dynamic, syllabus-aligned question banks.",
  },
  {
    icon: BarChart3,
    title: "Foundation Analytics",
    text: "Track performance in Physics, Chemistry, Maths, and Biology with actionable insights.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Portals",
    text: "Give schools, teachers, students, and parents secure, intuitive experiences.",
  },
];

export default function GuestPage({ onBack }) {
  return (
    <main className="guest-page guest-page--modern">
      <div className="guest-page__toolbar">
        <button type="button" className="guest-page__back" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      <div className="guest-page__content">
        <section className="guest-hero-card">
          <div className="guest-hero-card__copy">
            <span className="guest-eyebrow">Spectropy Education Technologies</span>
            <h1>Building brighter learning ecosystems.</h1>
            <p className="guest-hero-card__lead">
              Intelligent tools that connect educators, students, and institutions
              through clearer data and more engaging learning experiences.
            </p>
            <div className="guest-hero-card__actions">
              <span className="guest-pill">
                <Target size={15} />
                Education, empowered by technology
              </span>
            </div>
          </div>
          <div className="guest-hero-card__visual" aria-hidden="true">
            <div className="guest-orbit guest-orbit--one" />
            <div className="guest-orbit guest-orbit--two" />
            <div className="guest-visual-mark">S</div>
            <span className="guest-visual-dot guest-visual-dot--one" />
            <span className="guest-visual-dot guest-visual-dot--two" />
            <span className="guest-visual-dot guest-visual-dot--three" />
          </div>
        </section>

        <section className="guest-stat-grid" aria-label="Spectropy impact">
          <div className="guest-stat-card">
            <strong>2017</strong>
            <span>Vision started</span>
          </div>
          <div className="guest-stat-card">
            <strong>2022</strong>
            <span>Officially registered</span>
          </div>
          <div className="guest-stat-card">
            <strong>100+</strong>
            <span>Schools supported</span>
          </div>
          <div className="guest-stat-card">
            <strong>20</strong>
            <span>Junior colleges</span>
          </div>
        </section>

        <section className="guest-section-grid">
          <article className="guest-info-card guest-info-card--mission">
            <div className="guest-section-icon"><Target size={18} /></div>
            <span className="guest-eyebrow">Our mission</span>
            <h2>Make every learner visible.</h2>
            <p>
              Headquartered in Hyderabad, Spectropy is more than an EdTech company;
              we are a movement. We believe education should be accessible,
              engaging, and personalized, with every learner supported by meaningful
              insight.
            </p>
          </article>
          <article className="guest-info-card">
            <div className="guest-section-icon"><BarChart3 size={18} /></div>
            <span className="guest-eyebrow">Our approach</span>
            <h2>From data to better decisions.</h2>
            <p>
              We bridge the gap between teachers and students through intelligent
              digital tools that foster collaborative, data-driven learning
              environments where every learner can thrive.
            </p>
          </article>
        </section>

        <section className="guest-solutions-section">
          <div className="guest-section-heading">
            <div>
              <span className="guest-eyebrow">What we build</span>
              <h2>Solutions for the whole education journey.</h2>
            </div>
            <p>One connected ecosystem for classrooms, campuses, and communities.</p>
          </div>
          <div className="guest-solution-grid">
            {solutions.map(({ icon: Icon, title, text }) => (
              <article className="guest-solution-card" key={title}>
                <div className="guest-solution-card__icon"><Icon size={19} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="guest-contact-card">
          <div>
            <span className="guest-eyebrow">Connect with Spectropy</span>
            <h2>Let’s shape the future of learning together.</h2>
          </div>
          <div className="guest-contact-links">
            <a href="tel:+919391294429"><Phone size={16} /> +91 93912 94429</a>
            <a href="mailto:contact@spectropy.com"><Mail size={16} /> contact@spectropy.com</a>
            <a href="https://spectropy.com" target="_blank" rel="noopener noreferrer"><Globe size={16} /> spectropy.com</a>
          </div>
        </section>
      </div>
    </main>
  );
}
