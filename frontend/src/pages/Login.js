import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css';

const Login = () => {
  const { login, error, isSubmitting } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) navigate('/');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon"><i className="fa-solid fa-cloud-bolt"></i></div>
          <h2>Project Management Suite</h2>
          <p>Sign in to manage your projects, AWS accounts and billing</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pms-form-group">
            <label className="pms-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="pms-form-group">
            <label className="pms-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              required
            />
          </div>

          {error && <div className="pms-error-text login-error">{error}</div>}

          <button type="submit" className="pms-btn pms-btn-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? <><span className="pms-spinner"></span> Signing in...</> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
