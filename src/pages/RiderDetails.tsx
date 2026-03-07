import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Shield, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Phone, 
  CreditCard, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  User,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  StickyNote,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { auth } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  confirmColor = "bg-emerald-600",
  isLoading = false,
  children
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string;
  confirmText?: string;
  confirmColor?: string;
  isLoading?: boolean;
  children?: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200"
        >
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-zinc-900">{title}</h3>
            </div>
            <div className="space-y-4">
              <p className="text-zinc-500 font-medium leading-relaxed">
                {message}
              </p>
              {children}
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-4 text-white rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                  confirmColor
                )}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function RiderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rider, setRider] = useState<any | null>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [levies, setLevies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Action States
  const [isLevyModalOpen, setIsLevyModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [levyAmount, setLevyAmount] = useState('500');

  const fetchRiderData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch Rider
      const riderDoc = await getDoc(doc(db, 'riders', id)).catch(e => handleFirestoreError(e, OperationType.GET, `riders/${id}`));
      if (riderDoc && riderDoc.exists()) {
        setRider({ id: riderDoc.id, ...riderDoc.data() });
      } else {
        console.error('Rider not found');
        return;
      }

      // Fetch Verifications
      const vQuery = query(
        collection(db, 'verifications'), 
        where('riderId', '==', id), 
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const vSnap = await getDocs(vQuery).catch(e => handleFirestoreError(e, OperationType.LIST, 'verifications'));
      if (vSnap) {
        setVerifications(vSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      // Fetch Levies
      const lQuery = query(
        collection(db, 'levies'), 
        where('riderId', '==', id), 
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const lSnap = await getDocs(lQuery).catch(e => handleFirestoreError(e, OperationType.LIST, 'levies'));
      if (lSnap) {
        setLevies(lSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

    } catch (error) {
      console.error('Error fetching rider details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderData();
  }, [id]);

  const handleRecordLevy = async () => {
    if (!id || !auth.currentUser) return;
    setActionLoading(true);
    try {
      const amount = parseFloat(levyAmount);
      await addDoc(collection(db, 'levies'), {
        riderId: id,
        amount: amount,
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'paid',
        officerId: auth.currentUser.uid,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'levies'));

      setIsLevyModalOpen(false);
      await fetchRiderData();
    } catch (error) {
      console.error('Error recording levy:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !auth.currentUser || !noteText.trim()) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'riders', id), {
        notes: arrayUnion({
          text: noteText,
          author: auth.currentUser.email || auth.currentUser.uid,
          timestamp: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `riders/${id}`));

      setNoteText('');
      setIsNoteModalOpen(false);
      await fetchRiderData();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
        <p className="text-zinc-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Rider Profile...</p>
      </div>
    );
  }

  if (!rider) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-6 p-4 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-600">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-zinc-900">Rider Not Found</h1>
          <p className="text-zinc-500 max-w-xs mx-auto">The rider you are looking for does not exist or has been removed from the system.</p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to="/dashboard"
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div className="h-8 w-px bg-zinc-200 mx-2 hidden sm:block" />
              <div>
                <h1 className="text-xl font-black text-zinc-900 truncate max-w-[200px] sm:max-w-none">
                  {rider.fullName}
                </h1>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Rider Profile • {rider.plateNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                rider.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {rider.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Basic Info */}
          <div className="lg:col-span-1 space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden"
            >
              <div className="aspect-square bg-zinc-100 relative group">
                <img 
                  src={rider.photoUrl} 
                  alt={rider.fullName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="p-4 bg-white rounded-2xl text-zinc-900 font-bold flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" /> View Full Image
                  </button>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Full Name</p>
                    <p className="text-lg font-bold text-zinc-900">{rider.fullName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Plate Number</p>
                      <p className="font-bold text-zinc-900">{rider.plateNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">NIN</p>
                      <p className="font-bold text-zinc-900">{rider.nin}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Phone Number</p>
                    <p className="font-bold text-zinc-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-600" /> {rider.phoneNumber}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Residential Address</p>
                    <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                      <MapPin className="w-4 h-4 inline-block mr-1 text-red-500" /> {rider.address}
                    </p>
                  </div>
                  <div className="pt-4">
                    <a 
                      href={`sms:${rider.phoneNumber}?body=Hello ${rider.fullName}, this is OkadaGuard administration regarding your rider profile.`}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                    >
                      <MessageSquare className="w-5 h-5" /> Contact Rider
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Admin Actions */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
              <h3 className="text-lg font-black text-zinc-900 uppercase tracking-widest">Admin Actions</h3>
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => setIsLevyModalOpen(true)}
                  className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
                >
                  <Plus className="w-5 h-5" /> Record Daily Levy
                </button>
                <button 
                  onClick={() => setIsNoteModalOpen(true)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                >
                  <StickyNote className="w-5 h-5" /> Add Admin Note
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-2">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Verifications</p>
                <p className="text-2xl font-black text-zinc-900">{verifications.length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-2">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Levies Paid</p>
                <p className="text-2xl font-black text-zinc-900">{levies.length}</p>
              </div>
            </div>
          </div>

          {/* Right Column: History Tabs */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Verification History */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                <h2 className="text-xl font-black text-zinc-900 flex items-center gap-3">
                  <History className="text-emerald-600" /> Verification History
                </h2>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Last 50 Records
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Officer</th>
                      <th className="px-8 py-4">Type</th>
                      <th className="px-8 py-4">Result</th>
                      <th className="px-8 py-4">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {verifications.length > 0 ? (
                      verifications.map((v) => (
                        <tr key={v.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                                <User className="w-4 h-4 text-zinc-400" />
                              </div>
                              <span className="text-sm font-bold text-zinc-700">
                                {v.officerId.substring(0, 8)}...
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-4">
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-black uppercase tracking-tighter">
                              {v.type}
                            </span>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-2">
                              {v.result === 'Verified' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className={cn(
                                "text-xs font-bold",
                                v.result === 'Verified' ? "text-emerald-600" : "text-red-600"
                              )}>
                                {v.result}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-zinc-900">
                                {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'MMM d, yyyy') : 'N/A'}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'HH:mm:ss') : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-zinc-400">
                            <Clock className="w-8 h-8 opacity-20" />
                            <p className="text-sm font-medium">No verification records found for this rider.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Levy History */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                <h2 className="text-xl font-black text-zinc-900 flex items-center gap-3">
                  <CreditCard className="text-purple-600" /> Levy Payments
                </h2>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Revenue History
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Amount</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Officer</th>
                      <th className="px-8 py-4">Date Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {levies.length > 0 ? (
                      levies.map((l) => (
                        <tr key={l.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-8 py-4">
                            <span className="text-lg font-black text-zinc-900">₦{l.amount.toLocaleString()}</span>
                          </td>
                          <td className="px-8 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                              l.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            )}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-8 py-4">
                            <span className="text-xs font-bold text-zinc-500 font-mono">
                              {l.officerId?.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-zinc-900">
                                {l.timestamp?.toDate ? format(l.timestamp.toDate(), 'MMM d, yyyy') : l.date}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                {l.timestamp?.toDate ? format(l.timestamp.toDate(), 'HH:mm:ss') : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-zinc-400">
                            <TrendingUp className="w-8 h-8 opacity-20" />
                            <p className="text-sm font-medium">No levy payment records found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Admin Notes */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                <h2 className="text-xl font-black text-zinc-900 flex items-center gap-3">
                  <StickyNote className="text-zinc-900" /> Admin Notes
                </h2>
              </div>
              <div className="p-8 space-y-6">
                {rider.notes && rider.notes.length > 0 ? (
                  <div className="space-y-4">
                    {rider.notes.map((note: any, index: number) => (
                      <div key={index} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-2">
                        <p className="text-sm text-zinc-700 font-medium leading-relaxed">{note.text}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-200/50">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{note.author}</span>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">
                            {note.timestamp ? format(new Date(note.timestamp), 'MMM d, HH:mm') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <StickyNote className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400 font-medium">No admin notes yet.</p>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal 
        isOpen={isLevyModalOpen}
        onClose={() => setIsLevyModalOpen(false)}
        onConfirm={handleRecordLevy}
        title="Record Levy Payment"
        message={`Are you sure you want to record a levy payment of ₦${levyAmount} for ${rider.fullName}? This action will be logged under your officer ID.`}
        confirmText="Record Payment"
        confirmColor="bg-purple-600"
        isLoading={actionLoading}
      />

      <ConfirmationModal 
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onConfirm={handleAddNote}
        title="Add Admin Note"
        message="Add a permanent note to this rider's profile. This note will be visible to all administrators."
        confirmText="Add Note"
        confirmColor="bg-zinc-900"
        isLoading={actionLoading}
      >
        <div className="mt-4">
          <textarea 
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter note text here..."
            className="w-full h-32 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all resize-none font-medium"
          />
        </div>
      </ConfirmationModal>

    </div>
  );
}
