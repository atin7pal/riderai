import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, getDocs, limit, orderBy, onSnapshot, where, updateDoc, doc, arrayUnion, addDoc, serverTimestamp } from 'firebase/firestore';
import { BarChart3, Users, Shield, AlertTriangle, TrendingUp, Search, Download, Filter, Volume2, CheckCircle, MessageSquare, Plus, Clock, History, X, Loader2, Edit2, Save, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { useAuth } from '../App';

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRiders: 0,
    activeOfficers: 0,
    dailyLevy: 0,
    activeAlerts: 0
  });
  const [recentVerifications, setRecentVerifications] = useState<any[]>([]);
  const [activePanicAlerts, setActivePanicAlerts] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isRecordingLevy, setIsRecordingLevy] = useState(false);
  const [levyAmount, setLevyAmount] = useState('500');
  const [showHistory, setShowHistory] = useState(false);
  const [riderHistory, setRiderHistory] = useState<{ verifications: any[], levies: any[] }>({ verifications: [], levies: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEditingRider, setIsEditingRider] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ridersSnap = await getDocs(collection(db, 'riders')).catch(e => handleFirestoreError(e, OperationType.LIST, 'riders'));
        const officersSnap = await getDocs(collection(db, 'officers')).catch(e => handleFirestoreError(e, OperationType.LIST, 'officers'));
        
        if (ridersSnap && officersSnap) {
          setStats(prev => ({
            ...prev,
            totalRiders: ridersSnap.size,
            activeOfficers: officersSnap.size,
            dailyLevy: 45000, // Mock for now
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    const unsubscribeRiders = onSnapshot(
      collection(db, 'riders'),
      (snapshot) => {
        setRiders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'riders')
    );

    const unsubscribeVerifications = onSnapshot(
      query(collection(db, 'verifications'), orderBy('timestamp', 'desc'), limit(10)),
      (snapshot) => {
        setRecentVerifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'verifications')
    );

    const unsubscribePanic = onSnapshot(
      query(collection(db, 'panicAlerts'), where('status', '==', 'active'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivePanicAlerts(alerts);
        setStats(prev => ({ ...prev, activeAlerts: alerts.length }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'panicAlerts')
    );

    fetchData();
    return () => {
      unsubscribeRiders();
      unsubscribeVerifications();
      unsubscribePanic();
    };
  }, []);

  const resolveAlert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'panicAlerts', id), { status: 'resolved' }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `panicAlerts/${id}`));
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const playAudio = (base64Data: string) => {
    const audio = new Audio(base64Data);
    audio.play();
  };

  const addNote = async (riderId: string) => {
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    try {
      const note = {
        text: newNote,
        author: user?.displayName || user?.email || 'Admin',
        timestamp: new Date().toISOString()
      };
      await updateDoc(doc(db, 'riders', riderId), {
        notes: arrayUnion(note)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `riders/${riderId}`));
      
      setNewNote('');
      setSelectedRider((prev: any) => ({
        ...prev,
        notes: [...(prev.notes || []), note]
      }));
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  const recordLevy = async (riderId: string) => {
    if (!levyAmount || isNaN(Number(levyAmount))) return;
    setIsRecordingLevy(true);
    try {
      const levy = {
        riderId,
        amount: Number(levyAmount),
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'paid',
        officerId: user?.uid || 'admin',
        timestamp: serverTimestamp()
      };
      await addDoc(collection(db, 'levies'), levy).catch(e => handleFirestoreError(e, OperationType.CREATE, 'levies'));
      
      // Refresh history if it's open
      if (showHistory) {
        fetchRiderHistory(riderId);
      }
      alert('Levy payment recorded successfully!');
    } catch (error) {
      console.error('Error recording levy:', error);
    } finally {
      setIsRecordingLevy(false);
    }
  };

  const fetchRiderHistory = async (riderId: string) => {
    setLoadingHistory(true);
    setShowHistory(true);
    try {
      const vQuery = query(collection(db, 'verifications'), where('riderId', '==', riderId), orderBy('timestamp', 'desc'));
      const lQuery = query(collection(db, 'levies'), where('riderId', '==', riderId), orderBy('timestamp', 'desc'));
      
      const [vSnap, lSnap] = await Promise.all([
        getDocs(vQuery).catch(e => handleFirestoreError(e, OperationType.LIST, 'verifications')),
        getDocs(lQuery).catch(e => handleFirestoreError(e, OperationType.LIST, 'levies'))
      ]);

      setRiderHistory({
        verifications: vSnap ? vSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [],
        levies: lSnap ? lSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : []
      });
    } catch (error) {
      console.error('Error fetching rider history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartEdit = (rider: any) => {
    setEditFormData({ ...rider });
    setIsEditingRider(true);
  };

  const handleUpdateRider = async () => {
    if (!editFormData) return;
    setIsSavingEdit(true);
    try {
      const { id, ...dataToUpdate } = editFormData;
      // Remove fields that shouldn't be updated or are complex objects if any
      delete dataToUpdate.timestamp; 
      
      await updateDoc(doc(db, 'riders', id), dataToUpdate).catch(e => handleFirestoreError(e, OperationType.UPDATE, `riders/${id}`));
      
      // Update local state
      setRiders(prev => prev.map(r => r.id === id ? { ...r, ...dataToUpdate } : r));
      setSelectedRider((prev: any) => prev?.id === id ? { ...prev, ...dataToUpdate } : prev);
      setIsEditingRider(false);
      alert('Rider profile updated successfully!');
    } catch (error) {
      console.error('Error updating rider:', error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const statCards = [
    { title: 'Total Riders', value: stats.totalRiders, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Active Officers', value: stats.activeOfficers, icon: Shield, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Daily Revenue', value: `₦${stats.dailyLevy.toLocaleString()}`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
    { title: 'Panic Alerts', value: stats.activeAlerts, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  const filteredRiders = riders.filter(rider => 
    rider.fullName?.toLowerCase().includes(riderSearchQuery.toLowerCase()) ||
    rider.plateNumber?.toLowerCase().includes(riderSearchQuery.toLowerCase())
  ).slice(0, 5);

  const getRiderInfo = (riderId: string) => {
    return riders.find(r => r.id === riderId) || { fullName: 'Unknown Rider', plateNumber: 'N/A' };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Admin Dashboard</h1>
          <p className="text-zinc-500">Real-time monitoring of Akoko North East operations.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{stat.title}</p>
              <p className="text-3xl font-black text-zinc-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rider Search Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900">Rider Directory</h2>
            <p className="text-sm text-zinc-500 font-medium">Quickly find registered riders and their status.</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={riderSearchQuery}
              onChange={(e) => setRiderSearchQuery(e.target.value)}
              placeholder="Search by name or plate number..."
              className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
            />
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {riderSearchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-zinc-100"
            >
              {filteredRiders.length > 0 ? (
                filteredRiders.map((rider) => (
                  <motion.div
                    key={rider.id}
                    layout
                    className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-emerald-200 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-200">
                      <img src={rider.photoUrl} alt={rider.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-zinc-900 truncate">{rider.fullName}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          {rider.plateNumber}
                        </span>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          rider.status === 'active' ? "bg-emerald-500" : "bg-red-500"
                        )} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link 
                        to={`/rider/${rider.id}`}
                        className="p-2 text-zinc-400 hover:text-blue-600 transition-colors bg-white rounded-lg border border-zinc-100 shadow-sm"
                        title="Full Profile"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => setSelectedRider(rider)}
                        className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors bg-white rounded-lg border border-zinc-100 shadow-sm"
                        title="Quick View"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRider(rider);
                          fetchRiderHistory(rider.id);
                        }}
                        className="p-2 text-zinc-400 hover:text-purple-600 transition-colors bg-white rounded-lg border border-zinc-100 shadow-sm"
                        title="View History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-zinc-400 font-medium">
                  No riders found matching "{riderSearchQuery}"
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activePanicAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="animate-pulse" /> CRITICAL: Active Panic Alerts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePanicAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  layout
                  className="bg-red-50 border border-red-200 p-6 rounded-3xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center animate-pulse">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-red-900">{alert.riderName}</h4>
                      <p className="text-xs text-red-700 font-medium">
                        {alert.timestamp?.toDate ? format(alert.timestamp.toDate(), 'HH:mm:ss') : 'Just now'} • {alert.location.latitude.toFixed(4)}, {alert.location.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.audioData && (
                      <button
                        onClick={() => playAudio(alert.audioData)}
                        className="p-3 bg-white text-red-600 rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                        title="Play Audio Evidence"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                      title="Mark as Resolved"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="text-emerald-600" /> Recent Verifications
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search logs..." 
                className="pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                <tr>
                  <th className="px-6 py-4">Rider</th>
                  <th className="px-6 py-4">Officer</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Result</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <AnimatePresence mode="popLayout">
                  {recentVerifications.map((v, index) => {
                    const riderInfo = getRiderInfo(v.riderId);
                    return (
                      <motion.tr
                        key={v.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                        onClick={() => {
                          const fullRider = riders.find(r => r.id === v.riderId);
                          if (fullRider) setSelectedRider(fullRider);
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900">{riderInfo.fullName}</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">{riderInfo.plateNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-600 font-mono text-xs">{v.officerId.substring(0, 8)}...</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-bold uppercase">{v.type}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                            v.result === 'Verified' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>
                            {v.result}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-sm">
                          {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'MMM d, HH:mm') : 'Recent'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const fullRider = riders.find(r => r.id === v.riderId);
                              if (fullRider) {
                                setSelectedRider(fullRider);
                                fetchRiderHistory(fullRider.id);
                              }
                            }}
                            className="p-2 text-zinc-400 hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white space-y-8">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="text-emerald-400" /> Revenue Insights
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Target Collection</span>
                <span>85%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[85%]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-800 rounded-2xl">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">This Week</p>
                <p className="text-xl font-bold">₦320k</p>
              </div>
              <div className="p-4 bg-zinc-800 rounded-2xl">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Last Week</p>
                <p className="text-xl font-bold">₦290k</p>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-zinc-800">
            <p className="text-zinc-400 text-sm mb-4">Top Performing Officers</p>
            <div className="space-y-4">
              {[1, 2, 3].map((i, index) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + (index * 0.1) }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold">{i}</div>
                    <span className="text-sm">Officer #{i}42</span>
                  </div>
                  <span className="text-emerald-400 font-bold">₦12,400</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rider Details Modal */}
      <AnimatePresence>
        {selectedRider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRider(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="h-32 bg-emerald-600 relative">
                <button 
                  onClick={() => setSelectedRider(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors"
                >
                  <CheckCircle className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="px-8 pb-8">
                <div className="relative -mt-16 mb-6">
                  <div className="w-32 h-32 rounded-3xl border-4 border-white overflow-hidden shadow-lg bg-zinc-100">
                    <img src={selectedRider.photoUrl} alt={selectedRider.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900">{selectedRider.fullName}</h3>
                    <p className="text-zinc-500 font-medium">{selectedRider.plateNumber} • {selectedRider.status.toUpperCase()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">Phone</p>
                      <p className="font-bold text-zinc-900">{selectedRider.phoneNumber}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">NIN</p>
                      <p className="font-bold text-zinc-900">{selectedRider.nin}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 col-span-2">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">Address</p>
                      <p className="font-bold text-zinc-900">{selectedRider.address}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" /> Record Daily Levy
                      </h4>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₦</span>
                        <input
                          type="number"
                          value={levyAmount}
                          onChange={(e) => setLevyAmount(e.target.value)}
                          placeholder="Amount"
                          className="w-full pl-8 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                      </div>
                      <button
                        onClick={() => recordLevy(selectedRider.id)}
                        disabled={isRecordingLevy}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isRecordingLevy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" /> Admin Notes
                      </h4>
                    </div>
                    
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {selectedRider.notes && selectedRider.notes.length > 0 ? (
                        selectedRider.notes.map((note: any, i: number) => (
                          <div key={i} className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 space-y-1">
                            <p className="text-sm text-zinc-700 leading-relaxed">{note.text}</p>
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                              <span>{note.author}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(note.timestamp), 'MMM d, HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-400 text-center py-4 italic">No notes recorded for this rider.</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note..."
                        className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && addNote(selectedRider.id)}
                      />
                      <button
                        onClick={() => addNote(selectedRider.id)}
                        disabled={isAddingNote || !newNote.trim()}
                        className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 flex flex-wrap gap-3">
                    <Link 
                      to={`/rider/${selectedRider.id}`}
                      className="flex-1 min-w-[140px] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Full Profile
                    </Link>
                    <button 
                      onClick={() => fetchRiderHistory(selectedRider.id)}
                      className="flex-1 min-w-[140px] py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <History className="w-4 h-4" /> View History
                    </button>
                    <button 
                      onClick={() => handleStartEdit(selectedRider)}
                      className="flex-1 min-w-[140px] py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                    <button className="flex-1 min-w-[140px] py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors">
                      Suspend
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rider History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                    <img src={selectedRider?.photoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900">Activity History</h3>
                    <p className="text-zinc-500 font-medium">{selectedRider?.fullName} • {selectedRider?.plateNumber}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-3 bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 rounded-2xl transition-colors shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-500 font-bold animate-pulse">Retrieving history logs...</p>
                  </div>
                ) : (
                  <>
                    {/* Verification History */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600" /> Verification Logs
                      </h4>
                      <div className="space-y-3">
                        {riderHistory.verifications.length > 0 ? (
                          riderHistory.verifications.map((v) => (
                            <div key={v.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-zinc-200 text-zinc-600 text-[10px] font-black rounded uppercase">
                                    {v.type}
                                  </span>
                                  <span className={cn(
                                    "text-xs font-bold",
                                    v.result === 'Verified' ? "text-emerald-600" : "text-red-600"
                                  )}>
                                    {v.result}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                  Officer ID: {v.officerId.substring(0, 8)}...
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-zinc-900">
                                  {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'MMM d, yyyy') : 'N/A'}
                                </p>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">
                                  {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'HH:mm:ss') : ''}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                            <p className="text-zinc-400 text-sm font-medium">No verification records found.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Levy History */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" /> Payment History
                      </h4>
                      <div className="space-y-3">
                        {riderHistory.levies.length > 0 ? (
                          riderHistory.levies.map((l) => (
                            <div key={l.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-black text-zinc-900">₦{l.amount.toLocaleString()}</span>
                                  <span className={cn(
                                    "px-2 py-0.5 text-[10px] font-black rounded uppercase",
                                    l.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {l.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                  Date: {l.date}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-zinc-900">
                                  {l.timestamp?.toDate ? format(l.timestamp.toDate(), 'MMM d, yyyy') : 'N/A'}
                                </p>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">
                                  {l.timestamp?.toDate ? format(l.timestamp.toDate(), 'HH:mm:ss') : ''}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                            <p className="text-zinc-400 text-sm font-medium">No payment records found.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                <button 
                  onClick={() => setShowHistory(false)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Rider Modal */}
      <AnimatePresence>
        {isEditingRider && editFormData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingRider(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Edit2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900">Edit Rider Profile</h3>
                    <p className="text-sm text-zinc-500 font-medium">Update account details for {editFormData.fullName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingRider(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                      type="text"
                      value={editFormData.fullName}
                      onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Plate Number</label>
                    <input
                      type="text"
                      value={editFormData.plateNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, plateNumber: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input
                      type="text"
                      value={editFormData.phoneNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">NIN</label>
                    <input
                      type="text"
                      value={editFormData.nin}
                      onChange={(e) => setEditFormData({ ...editFormData, nin: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Residential Address</label>
                    <textarea
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Account Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-4">
                <button 
                  onClick={() => setIsEditingRider(false)}
                  className="flex-1 py-4 bg-white border border-zinc-200 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateRider}
                  disabled={isSavingEdit}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
