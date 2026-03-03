import React from 'react';

export default function LoginForm({
  username,
  email,
  password,
  confirmPassword,
  isLogin,
  error,
  setUsername,
  setEmail,
  setPassword,
  setConfirmPassword,
  setIsLogin,
  onSubmit,
  isLoading = false,
  loadingText = '',
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className={`bg-white rounded-lg shadow-2xl p-8 w-full max-w-md transition-all ${isLoading ? 'scale-[0.995]' : 'scale-100'}`}>
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          {isLogin ? 'Login' : 'Register'}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Username */}
          <input
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit(e)}
            required
            disabled={isLoading}
          />

          {/* Email (Register only) */}
          {!isLogin && (
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit(e)}
              required
              disabled={isLoading}
            />
          )}

          {/* Password */}
          <input
            type="password"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit(e)}
            required
            disabled={isLoading}
          />

          {/* Confirm Password (Register only) */}
          {!isLogin && (
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit(e)}
              required
              disabled={isLoading}
            />
          )}

          <button
            onClick={onSubmit}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {loadingText || (isLogin ? 'Signing in...' : 'Creating account...')}
              </span>
            ) : (
              isLogin ? 'Login' : 'Register'
            )}
          </button>
        </div>

        <button
          disabled={isLoading}
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-4 text-blue-600 text-sm disabled:text-blue-300 disabled:cursor-not-allowed"
        >
          {isLogin
            ? "Don't have an account? Register"
            : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}
