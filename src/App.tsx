import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, createContext, useContext } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Layout } from './components/Layout';
import { handleFirestoreError, OperationType } from './utils/errorHandlers';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { RiderDetails } from './pages/RiderDetails';
import { Registration } from './pages/Registration';
import { Verification } from './pages/Verification';
import { Panic } from './pages/Panic';
import { Chat } from './pages/Chat';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const officerDoc = await getDoc(doc(db, 'officers', user.uid)).catch(e => handleFirestoreError(e, OperationType.GET, `officers/${user.uid}`));
          if (officerDoc && officerDoc.exists()) {
            setRole(officerDoc.data().role);
          } else if (user.email === 'connect2sahilrana@gmail.com') {
            setRole('admin');
          } else {
            setRole('rider');
          }
        } catch (error) {
          console.error('Error checking role:', error);
          if (user.email === 'connect2sahilrana@gmail.com') {
            setRole('admin');
          } else {
            setRole('rider');
          }
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={role === 'admin' ? <Dashboard /> : <Navigate to="/" />} />
            <Route path="/rider/:id" element={role === 'admin' ? <RiderDetails /> : <Navigate to="/" />} />
            <Route path="/registration" element={['admin', 'registration'].includes(role || '') ? <Registration /> : <Navigate to="/" />} />
            <Route path="/verification" element={['admin', 'officer'].includes(role || '') ? <Verification /> : <Navigate to="/" />} />
            <Route path="/panic" element={<Panic />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </Layout>
      </Router>
    </AuthContext.Provider>
  );
}
