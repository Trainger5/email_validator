import { useEffect, useState } from "react";
import { me } from "./api";
import { AppRouter } from "./Router";
import "./styles.css";

export default function App() {
  const [authUser, setAuthUser] = useState<{ username: string; role: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const user = await me(token);
      if (user.error) {
        throw new Error(user.error);
      }
      setAuthUser({ username: user.username, role: user.role });
    } catch {
      localStorage.removeItem('token');
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  const handleLogin = (user: { username: string; role: string }) => {
    setAuthUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthUser(null);
  };

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <AppRouter
      authUser={authUser}
      onLogin={handleLogin}
      onLogout={handleLogout}
    />
  );
}
