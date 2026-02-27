/**
 * Main Layout Component
 * Wraps pages with navbar and footer
 */

import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useSettings } from '../../hooks/useSettings';

const Layout = () => {
  const { platform_name } = useSettings();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-4">{platform_name}</h3>
              <p className="text-sm text-gray-600">
                A community-driven platform to help reunite lost items with their rightful owners.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/" className="text-gray-600 hover:text-primary-600">Browse Items</a></li>
                <li><a href="/report" className="text-gray-600 hover:text-primary-600">Report Found Item</a></li>
                <li><a href="/how-it-works" className="text-gray-600 hover:text-primary-600">How It Works</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/faq" className="text-gray-600 hover:text-primary-600">FAQ</a></li>
                <li><a href="/contact" className="text-gray-600 hover:text-primary-600">Contact Us</a></li>
                <li><a href="/about" className="text-gray-600 hover:text-primary-600">About / Developer</a></li>
                <li><a href="/report-abuse" className="text-gray-600 hover:text-primary-600">Report Abuse</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy" className="text-gray-600 hover:text-primary-600">Privacy Policy</a></li>
                <li><a href="/terms" className="text-gray-600 hover:text-primary-600">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} {platform_name}. All rights reserved.</p>
            <p className="mt-2">
              Built with ❤️ by{' '}
              <a href="/about" className="text-blue-600 hover:text-blue-700 font-medium">
                Sudharshan S
              </a>
              {' '}— Founder & Developer
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
