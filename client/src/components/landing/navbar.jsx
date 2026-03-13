
import { useState, useEffect } from "react"
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Sun, Moon } from "lucide-react"
import { Button } from "@/components/landing/ui/button"
import { useTheme } from "@/context/ThemeContext"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/accounts", label: "Accounts" },
  { href: "/demo-trading", label: "Demo Trading" },
  { href: "/broker-program", label: "Broker Program" },
]

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { theme, toggleTheme, isDark } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-4 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Floating Pill Navbar */}
        <nav className="bg-white rounded-full shadow-lg px-2 py-2 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center pl-2">
            <img 
              src="/images/stockex_logo.png" 
              alt="STOCKEX" 
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? "bg-yellow-accent text-deep-blue" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden lg:flex items-center gap-2 pr-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
            <Link to="/login">
              <Button variant="ghost" className="text-sm font-medium text-gray-700 hover:text-deep-blue rounded-full">
                Log In
              </Button>
            </Link>
            <Link to="/login?register=true">
              <Button className="bg-yellow-accent hover:bg-yellow-500 text-deep-blue font-semibold px-5 rounded-full">
                Open Account
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 mr-1"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-2 bg-white rounded-2xl shadow-lg p-4">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`block text-sm font-medium py-3 px-4 rounded-xl transition-colors ${
                      isActive 
                        ? "bg-yellow-accent text-deep-blue" 
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-gray-100">
                {/* Mobile Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </span>
                  {isDark ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700" />
                  )}
                </button>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full rounded-full">Log In</Button>
                </Link>
                <Link to="/login?register=true" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button className="w-full bg-yellow-accent hover:bg-yellow-500 text-deep-blue font-semibold rounded-full">Open Account</Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
