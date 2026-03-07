import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Camera, User, Phone, MapPin, CreditCard, Bike, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

export function Registration() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    address: '',
    nin: '',
    plateNumber: '',
    motorcycleDetails: '',
    rfidCardId: '',
    photoUrl: 'https://picsum.photos/seed/rider/400/400', // Placeholder for now
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const riderRef = await addDoc(collection(db, 'riders'), {
        ...formData,
        status: 'active',
        registrationFeePaid: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, 'riders');
        throw e;
      });

      if (riderRef) {
        // Create a basic PanicAlert entry to ensure rider details are available in the collection
        await addDoc(collection(db, 'panicAlerts'), {
          riderId: riderRef.id,
          riderName: formData.fullName,
          timestamp: serverTimestamp(),
          location: { latitude: 0, longitude: 0 }, // Placeholder location
          status: 'resolved', // Set to resolved so it doesn't trigger an active alert
          audioData: '',
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'panicAlerts'));
      }

      setSuccess(true);
      setFormData({
        fullName: '',
        phoneNumber: '',
        address: '',
        nin: '',
        plateNumber: '',
        motorcycleDetails: '',
        rfidCardId: '',
        photoUrl: 'https://picsum.photos/seed/rider/400/400',
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error adding rider:', error);
      alert('Failed to register rider. Please check permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900">Rider Registration</h1>
        <p className="text-zinc-500">Create a new digital identity for an Okada rider.</p>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Rider registered successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6">
        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="w-32 h-32 bg-zinc-100 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-dashed border-zinc-200 group-hover:border-emerald-400 transition-colors">
              <img src={formData.photoUrl} alt="Rider" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="text-white w-8 h-8" />
              </div>
            </div>
            <p className="text-xs text-center mt-2 text-zinc-500 font-bold uppercase tracking-widest">Capture Photo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" /> Full Name
            </label>
            <input
              required
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4" /> Phone Number
            </label>
            <input
              required
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="+234..."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Residential Address
            </label>
            <textarea
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none min-h-[100px]"
              placeholder="Enter full address..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> NIN Number
            </label>
            <input
              required
              type="text"
              value={formData.nin}
              onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="11-digit NIN"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
              <Bike className="w-4 h-4" /> Plate Number
            </label>
            <input
              required
              type="text"
              value={formData.plateNumber}
              onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="ABC-123-XY"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> RFID Card ID
            </label>
            <input
              required
              type="text"
              value={formData.rfidCardId}
              onChange={(e) => setFormData({ ...formData, rfidCardId: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="Scan or enter RFID ID"
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Register Rider'}
        </button>
      </form>
    </div>
  );
}
