// src/GuestPage.jsx
import React from "react";

export default function GuestPage({ onBack }) {
  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>← Back</button>

      <div style={styles.companyCard}>
        <h1>📘 SPECTROPY Education Technologies</h1>
        <p>
          Empowering schools with smart, secure, and scalable digital solutions.
        </p>
        <p>
          <strong>Founded:</strong> 2020<br />
          <strong>Headquarters:</strong> Hyderabad, Telangana<br />
          <strong>Email:</strong> <a href="spectropy@gmail.com">spectropy@gmail.com</a><br />
          <strong>Website:</strong> <a href="https://spectropy.com" target="_blank">spectropy.com</a>
        </p>
        <p>
          Our mission is to bridge the gap between traditional education and modern technology, 
          providing seamless portals for schools, teachers, students, and parents.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  companyCard: { 
    background: '#f8f9fa', 
    padding: 32, 
    borderRadius: 12, 
    border: '1px solid #dee2e6', 
    maxWidth: 600, 
    margin: '0 auto' 
  },
};