import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import { CreditCard, UserCheck, Search, Loader2, CheckCircle2, XCircle, MapPin, ShieldAlert, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function Verification() {
  const { user } = useAuth();
  const [method, setMethod] = useState<'RFID' | 'Face' | 'QR' | null>(null);
  const [rfidInput, setRfidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rider, setRider] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (method === 'QR') {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
      }
    };
  }, [method]);

  function onScanSuccess(decodedText: string) {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => {
        setMethod(null);
        setRfidInput(decodedText);
        handleRfidSearch(decodedText);
      }).catch(error => console.error("Failed to clear scanner", error));
    }
  }

  function onScanFailure(error: any) {
    // console.warn(`Code scan error = ${error}`);
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleRfidSearch = async (overrideInput?: string) => {
    const inputToUse = overrideInput || rfidInput;
    if (!inputToUse) return;
    
    setLoading(true);
    setVerificationResult(null);
    try {
      const q = query(collection(db, 'riders'), where('rfidCardId', '==', inputToUse));
      const querySnapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'riders'));
      if (querySnapshot && !querySnapshot.empty) {
        const riderData = querySnapshot.docs[0].data();
        setRider({ id: querySnapshot.docs[0].id, ...riderData });
        setVerificationResult({ success: true, message: `Rider found and verified via ${overrideInput ? 'QR' : 'RFID'}.` });
        logVerification(querySnapshot.docs[0].id, overrideInput ? 'QR' : 'RFID', 'Verified');
      } else {
        setVerificationResult({ success: false, message: `No rider found with this ${overrideInput ? 'QR' : 'RFID'} ID.` });
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFaceVerification = async () => {
    if (!capturedImage || !rider) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      const prompt = "Compare these two images. The first is a registered rider photo, the second is a live capture. Are they the same person? Respond with a JSON object: { \"match\": boolean, \"confidence\": number, \"reason\": string }";

      // Convert captured image to base64 part
      const capturedPart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: capturedImage.split(',')[1],
        },
      };

      // For the registered image, we'd ideally fetch it and convert to base64
      // For this demo, we'll assume the AI can "see" the registered photo if we provide it
      // Actually, we need to provide both as parts.
      // Let's fetch the registered photo and convert to base64
      const registeredPhotoResponse = await fetch(rider.photoUrl);
      const registeredBlob = await registeredPhotoResponse.blob();
      const registeredBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(registeredBlob);
      });

      const registeredPart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: registeredBase64.split(',')[1],
        },
      };

      const response = await ai.models.generateContent({
        model,
        contents: { parts: [registeredPart, capturedPart, { text: prompt }] },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.match && result.confidence > 0.8) {
        setVerificationResult({ success: true, message: `Face match verified! Confidence: ${Math.round(result.confidence * 100)}%` });
        logVerification(rider.id, 'Face', 'Verified');
      } else {
        setVerificationResult({ success: false, message: `Face mismatch! Confidence: ${Math.round(result.confidence * 100)}%. Reason: ${result.reason}` });
        logVerification(rider.id, 'Face', 'Mismatch');
      }
    } catch (error) {
      console.error('Error in face verification:', error);
      setVerificationResult({ success: false, message: 'AI verification failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const logVerification = async (riderId: string, type: string, result: string) => {
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          await addDoc(collection(db, 'verifications'), {
            riderId,
            officerId: user?.uid,
            type,
            result,
            timestamp: serverTimestamp(),
            location: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            }
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, 'verifications');
        }
      });
    } catch (error) {
      console.error('Error logging verification:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900">Rider Verification</h1>
        <p className="text-zinc-500">Verify rider identity using RFID or Facial Recognition.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="text-emerald-600" /> Identification
              </h2>
              <button
                onClick={() => setMethod(method === 'QR' ? null : 'QR')}
                className={cn(
                  "p-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold",
                  method === 'QR' ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                <QrCode className="w-4 h-4" /> {method === 'QR' ? 'Close Scanner' : 'Scan QR'}
              </button>
            </div>
            
            <AnimatePresence>
              {method === 'QR' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div id="qr-reader" className="rounded-2xl overflow-hidden border-2 border-dashed border-zinc-200" />
                  <p className="text-center text-xs text-zinc-400 mt-2 italic">Position the QR code within the frame to scan</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <input
                type="text"
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                placeholder="Enter RFID or ID"
                className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleRfidSearch()}
                disabled={loading}
                className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {rider && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6"
            >
              <div className="flex items-center gap-4">
                <img src={rider.photoUrl} alt="Rider" className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-100" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{rider.fullName}</h3>
                  <p className="text-zinc-500">{rider.plateNumber}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Status</p>
                  <p className="font-bold text-emerald-600">{rider.status}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Daily Levy</p>
                  <p className="font-bold text-zinc-900">Paid</p>
                </div>
              </div>

              {!verificationResult?.success && (
                <button
                  onClick={() => { setMethod('Face'); startCamera(); }}
                  className="w-full py-3 border-2 border-emerald-600 text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-5 h-5" /> Biometric Verification
                </button>
              )}
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          <AnimatePresence>
            {method === 'Face' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6"
              >
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserCheck className="text-emerald-600" /> Face Recognition
                </h2>
                <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden">
                  {!capturedImage ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <button
                        onClick={capturePhoto}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-white text-zinc-900 rounded-full font-bold shadow-lg hover:bg-zinc-100 transition-colors"
                      >
                        Capture
                      </button>
                    </>
                  ) : (
                    <>
                      <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                      <button
                        onClick={() => { setCapturedImage(null); startCamera(); }}
                        className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                {capturedImage && (
                  <button
                    onClick={handleFaceVerification}
                    disabled={loading}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin w-6 h-6" /> : 'Verify Identity'}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {verificationResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-6 rounded-[2rem] border flex items-start gap-4",
                verificationResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
              )}
            >
              {verificationResult.success ? <CheckCircle2 className="w-8 h-8 shrink-0" /> : <ShieldAlert className="w-8 h-8 shrink-0" />}
              <div>
                <h4 className="font-bold text-lg">{verificationResult.success ? 'Verification Successful' : 'Verification Failed'}</h4>
                <p className="text-sm opacity-90">{verificationResult.message}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
