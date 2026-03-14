'use client';

import React from 'react';
import Hero from './Hero';
import CardShredder from './CardShredder';
import ValueProposition from './ValueProposition';
import ClientComplaints from './ClientComplaints';
import ContactForm from './ContactForm';
import BookingSection from './BookingSection';

const HomeContent: React.FC = () => {
  return (
    <>
      <Hero />
      <CardShredder />
      <ValueProposition />
      <ClientComplaints />
      <ContactForm />
      <BookingSection />
    </>
  );
};

export default HomeContent;
