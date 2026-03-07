import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { AlertTriangle, MapPin, Clock, CheckCircle, Loader2, ShieldAlert, Radio, Play, Square, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

export function Panic() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isPanicActive, setIsPanicActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (['admin', 'officer'].includes(role || '')) {
      const q = query(collection(db, 'panicAlerts'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAlerts(alertsData);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'panicAlerts'));
      return unsubscribe;
    }
  }, [role]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) return resolve('');

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
        
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.stop();
      setRecording(false);
    });
  };

  const triggerPanic = async () => {
    setLoading(true);
    await startRecording();
    
    // Record for 5 seconds then send
    setTimeout(async () => {
      const audioData = await stopRecording();
      
      try {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            await addDoc(collection(db, 'panicAlerts'), {
              riderId: user?.uid,
              riderName: user?.displayName,
              timestamp: serverTimestamp(),
              location: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              },
              status: 'active',
              audioData: audioData // Store base64 audio
            });
            setIsPanicActive(true);
            setTimeout(() => setIsPanicActive(false), 5000);
          } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, 'panicAlerts');
          }
        }, (err) => {
          console.error("Geo error:", err);
          alert("Geolocation is required for panic alerts.");
        });
      } catch (error) {
        console.error('Error triggering panic:', error);
      } finally {
        setLoading(false);
      }
    }, 5000);
  };

  const resolveAlert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'panicAlerts', id), { status: 'resolved' });
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const playAudio = (base64Data: string) => {
    const audio = new Audio(base64Data);
    audio.play();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900">Emergency Panic System</h1>
        <p className="text-zinc-500">Instant emergency assistance for riders and real-time monitoring for officers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900">Emergency Button</h2>
              <p className="text-sm text-zinc-500">Click to trigger an emergency alert. The system will record 5 seconds of audio and capture your GPS location.</p>
            </div>
            
            <button
              onClick={triggerPanic}
              disabled={loading || isPanicActive || recording}
              className={cn(
                "w-full aspect-square rounded-full border-[12px] flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xl",
                recording || isPanicActive 
                  ? "bg-red-600 border-red-200 text-white animate-pulse" 
                  : "bg-white border-zinc-100 text-red-600 hover:border-red-50"
              )}
            >
              {loading ? (
                <Loader2 className="w-12 h-12 animate-spin" />
              ) : recording ? (
                <>
                  <Square className="w-12 h-12" />
                  <span className="font-black text-2xl uppercase tracking-tighter">Recording...</span>
                </>
              ) : (
                <>
                  <Radio className="w-12 h-12" />
                  <span className="font-black text-2xl uppercase tracking-tighter">Panic</span>
                </>
              )}
            </button>
            
            {isPanicActive && (
              <p className="text-red-600 font-bold animate-bounce">ALERT SENT! HELP IS ON THE WAY.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="text-red-600" /> Active Alerts
            </h2>
            
            <div className="space-y-4">
              {alerts.length === 0 && (
                <div className="py-12 text-center text-zinc-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No active emergency alerts.</p>
                </div>
              )}
              
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "p-6 rounded-2xl border flex items-center justify-between gap-4",
                    alert.status === 'active' ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100 grayscale"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      alert.status === 'active' ? "bg-red-600 text-white animate-pulse" : "bg-zinc-200 text-zinc-500"
                    )}>
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900">{alert.riderName || 'Unknown Rider'}</h4>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alert.timestamp?.toDate ? format(alert.timestamp.toDate(), 'HH:mm:ss') : 'Just now'}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {alert.location.latitude.toFixed(4)}, {alert.location.longitude.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {alert.audioData && (
                      <button
                        onClick={() => playAudio(alert.audioData)}
                        className="p-2 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 transition-colors"
                        title="Play Audio Evidence"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    )}
                    {alert.status === 'active' && ['admin', 'officer'].includes(role || '') && (
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
