// src/GuestPage.jsx
import React from "react";

export default function GuestPage({ onBack }) {
  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>
        ← Back
      </button>

      <div style={styles.companyCard}>
        <h1 style={styles.title}>📘 Spectropy Education Technologies</h1>
        <p style={styles.tagline}>
          <em>Architects of a Brighter Educational Future</em>
        </p>

        <p>
          Headquartered in Hyderabad, Spectropy is more than an EdTech company—we are a movement. Born from a vision in <strong>2017</strong> and officially registered in <strong>2022</strong>, we’ve grown from a home-office startup into a trusted partner for over <strong>100 schools</strong> and <strong>20 junior colleges</strong> across India.
        </p>

        <h2 style={styles.sectionHeading}>Our Mission</h2>
        <p>
          We believe education should be <strong>accessible, engaging, and personalized</strong>. By bridging the gap between teachers and students through intelligent digital tools, we foster collaborative, data-driven learning environments where every learner can thrive.
        </p>

        <h2 style={styles.sectionHeading}>Our Solutions</h2>
        <ul style={styles.list}>
          <li><strong>Learning Management System (LMS)</strong> – Centralize curriculum, assignments, and communication.</li>
          <li><strong>AI-Ready Question Paper Generator</strong> – Create customized assessments from dynamic, syllabus-aligned question banks.</li>
          <li><strong>IIT/NEET Foundation Analytics</strong> – Real-time performance tracking in Physics, Chemistry, Maths, and Biology.</li>
          <li><strong>Role-Based Portals</strong> – Secure, intuitive dashboards for schools, teachers, students, and parents.</li>
        </ul>

        <h2 style={styles.sectionHeading}>Impact at Scale</h2>
        <p>
          From classroom instruction to institutional strategy, Spectropy empowers educators with cutting-edge tools while inspiring students to reach their full potential—because we believe every child deserves the opportunity to succeed.
        </p>

        <div style={styles.contactSection}>
          <p>
            <strong>📞 Phone:</strong> <a href="tel:+919391294429" style={styles.link}>+91 93912 94429</a> (10:00 AM – 7:00 PM)<br />
            <strong>✉️ Email:</strong> <a href="mailto:contact@spectropy.com" style={styles.link}>contact@spectropy.com</a><br />
            <strong>🌐 Website:</strong> <a href="https://spectropy.com" target="_blank" rel="noopener noreferrer" style={styles.link}>spectropy.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  },
  backButton: {
    padding: '8px 16px',
    margin: '0 0 24px',
    border: '1px solid #3182ce',
    background: 'white',
    color: '#3182ce',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  companyCard: {
    background: 'white',
    padding: '36px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    maxWidth: '800px',
    margin: '0 auto',
    lineHeight: '1.7',
  },
  title: {
    color: '#1e55a0',
    fontSize: '28px',
    marginBottom: '8px',
  },
  tagline: {
    fontSize: '16px',
    color: '#5a6b82',
    fontStyle: 'italic',
    marginBottom: '24px',
  },
  sectionHeading: {
    fontSize: '20px',
    color: '#2d3748',
    marginTop: '24px',
    marginBottom: '12px',
  },
  list: {
    paddingLeft: '20px',
    marginBottom: '20px',
    color: '#333',
  },
  contactSection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #edf2f7',
    fontSize: '15px',
  },
  link: {
    color: '#1e55a0',
    textDecoration: 'none',
    fontWeight: '500',
  },
};