import { useAuth } from '../App';
import { Shield, CreditCard, UserCheck, AlertCircle, BarChart3, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

export function Home() {
  const { user, login, role } = useAuth();

  const features = [
    { title: 'RFID Verification', icon: CreditCard, desc: 'Instant rider identity and levy status check via NFC/RFID.' },
    { title: 'AI Face Recognition', icon: UserCheck, desc: 'Advanced biometric verification to prevent identity theft.' },
    { title: 'Levy Enforcement', icon: BarChart3, desc: 'Digital tracking of daily levy payments and revenue monitoring.' },
    { title: 'Panic System', icon: AlertCircle, desc: 'Emergency assistance for riders with GPS and audio evidence.' },
    { title: 'GPS Monitoring', icon: MapPin, desc: 'Real-time patrol tracking and verification location logging.' },
    { title: 'Officer Verification', icon: Shield, desc: 'Riders can verify the authenticity of enforcement officers.' },
  ];

  return (
    <div className="space-y-16">
      <section className="text-center space-y-6 max-w-3xl mx-auto py-12">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-5xl sm:text-6xl font-extrabold text-zinc-900 tracking-tight leading-tight"
        >
          Securing <span className="text-emerald-600">Akoko North East</span> Okada Transport
        </motion.h1>
        <p className="text-xl text-zinc-600 leading-relaxed">
          The official AI-powered platform for rider registration, verification, and levy enforcement. 
          Protecting riders and ensuring transparent governance.
        </p>
        {!user && (
          <button
            onClick={login}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95"
          >
            Get Started with Google
          </button>
        )}
        {user && (
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-6 py-3 bg-zinc-100 rounded-2xl font-semibold text-zinc-700">
              Welcome back, {user.displayName}
            </div>
            <div className="px-6 py-3 bg-emerald-100 text-emerald-700 rounded-2xl font-bold uppercase tracking-wider">
              Role: {role}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-50 transition-colors">
              <f.icon className="w-8 h-8 text-zinc-600 group-hover:text-emerald-600 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">{f.title}</h3>
            <p className="text-zinc-600 leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </section>

      <section className="bg-zinc-900 rounded-[3rem] p-12 text-white overflow-hidden relative">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Real-time Enforcement Dashboard</h2>
          <p className="text-zinc-400 text-lg mb-8">
            Administrators can monitor revenue collection, officer activity, and emergency alerts in real-time. 
            Data-driven decisions for a safer Akoko North East.
          </p>
          <div className="flex gap-8">
            <div>
              <div className="text-4xl font-bold text-emerald-400">2.4k+</div>
              <div className="text-zinc-500 text-sm uppercase font-bold tracking-widest">Registered Riders</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-emerald-400">150+</div>
              <div className="text-zinc-500 text-sm uppercase font-bold tracking-widest">Active Officers</div>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-600/20 to-transparent hidden lg:block" />
      </section>
    </div>
  );
}
