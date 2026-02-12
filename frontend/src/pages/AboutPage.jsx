/**
 * About Page
 * Founder and developer information
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Github, Linkedin, Mail, Code, Heart, Shield } from 'lucide-react';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 h-40" />
          <div className="px-8 pb-8 relative">
            <div className="-mt-16 mb-6">
              <img
                src="/founder.jpg"
                alt="Sudharshan S"
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Sudharshan S</h1>
            <p className="text-lg text-blue-600 font-medium mt-1">Founder & Developer</p>
            <p className="text-gray-600 mt-4 max-w-2xl leading-relaxed">
              Passionate about building technology that makes a real difference in people's lives. 
              I created this platform to help communities reunite lost items with their rightful owners 
              through trust and collaboration.
            </p>

            {/* Social Links */}
            <div className="flex gap-3 mt-6">
              <a
                href="https://github.com/sudharshan128"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="mailto:sudharshan@example.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                Contact
              </a>
            </div>
          </div>
        </div>

        {/* Vision & Values */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Community First</h3>
            <p className="text-sm text-gray-600">
              Built with the belief that communities thrive when people help each other. 
              Every feature is designed to foster trust and connection.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Trust & Security</h3>
            <p className="text-sm text-gray-600">
              Security and privacy are at the core. The verification system ensures 
              only rightful owners can claim their belongings.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Code className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Modern Tech</h3>
            <p className="text-sm text-gray-600">
              Built with React, Supabase, and Node.js — modern technologies 
              that deliver a fast, reliable, and scalable experience.
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Built With</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'React', color: 'bg-cyan-100 text-cyan-700' },
              { name: 'Vite', color: 'bg-purple-100 text-purple-700' },
              { name: 'Tailwind CSS', color: 'bg-sky-100 text-sky-700' },
              { name: 'Supabase', color: 'bg-green-100 text-green-700' },
              { name: 'Node.js', color: 'bg-lime-100 text-lime-700' },
              { name: 'Express', color: 'bg-gray-100 text-gray-700' },
              { name: 'PostgreSQL', color: 'bg-blue-100 text-blue-700' },
              { name: 'Lucide Icons', color: 'bg-orange-100 text-orange-700' },
            ].map((tech) => (
              <span
                key={tech.name}
                className={`${tech.color} px-3 py-2 rounded-lg text-sm font-medium text-center`}
              >
                {tech.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
