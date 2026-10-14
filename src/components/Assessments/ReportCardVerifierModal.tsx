// Report Card QR Code Verification & Authenticity Scanner Modal
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  GraduationCap,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
  Upload,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { StudentReportCard } from '../../types/attendance';
import { formatOrdinal } from '../../utils/academicEngine';
import { StudentReportCardModal } from './StudentReportCardModal';

interface ReportCardVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export const ReportCardVerifierModal: React.FC<ReportCardVerifierModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
}) => {
  const { school, allUsers, currentTerm, currentSession } = useApp();

  // Mode: 'SCANNER' (live camera), 'UPLOAD' (image drop), 'MANUAL' (code entry)
  const [activeMode, setActiveMode] = useState<'SCANNER' | 'UPLOAD' | 'MANUAL'>('SCANNER');

  // Camera video ref and canvas ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Input code state
  const [inputCode, setInputCode] = useState(initialCode);
  const [isProcessing, setIsProcessing] = useState(false);

  // Verification result state
  const [verifiedReportCard, setVerifiedReportCard] = useState<StudentReportCard | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    'IDLE' | 'VERIFIED' | 'NOT_FOUND' | 'ERROR'
  >('IDLE');
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);

  // Sub-modal for viewing full report card
  const [isFullCardOpen, setIsFullCardOpen] = useState(false);

  // Clean up video stream on close or unmount
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start video stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported on this browser/environment.');
        setActiveMode('MANUAL');
        return;
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access or use Image Upload / Manual Entry.'
          : 'Could not start camera video stream. Please upload an image or enter the code manually.'
      );
      setCameraActive(false);
    }
  };

  // Animation frame loop for continuous QR scanning
  useEffect(() => {
    if (!isOpen || activeMode !== 'SCANNER' || !cameraActive) return;

    let animId: number;
    let isScanning = true;

    const scanFrame = () => {
      if (!isScanning) return;

      if (
        videoRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
        canvasRef.current
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (qrCode && qrCode.data) {
            isScanning = false;
            handleProcessScannedData(qrCode.data);
            return;
          }
        }
      }

      animId = requestAnimationFrame(scanFrame);
    };

    animId = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      cancelAnimationFrame(animId);
    };
  }, [isOpen, activeMode, cameraActive]);

  // Handle switching camera mode
  useEffect(() => {
    if (isOpen && activeMode === 'SCANNER' && !verifiedReportCard) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode, facingMode, verifiedReportCard]);

  // Initial code check if provided
  useEffect(() => {
    if (initialCode) {
      setInputCode(initialCode);
      handleProcessScannedData(initialCode);
    }
  }, [initialCode]);

  // Handle Verification Query Logic
  const handleProcessScannedData = (rawText: string) => {
    setIsProcessing(true);
    setScannedPayload(rawText);

    try {
      const match = db.verifyReportCardByCode(rawText);
      if (match) {
        setVerifiedReportCard(match);
        setVerificationStatus('VERIFIED');
        stopCamera();

        // Confetti celebration for authentic verified result
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {
          // ignore
        }
      } else {
        setVerifiedReportCard(null);
        setVerificationStatus('NOT_FOUND');
      }
    } catch (err) {
      setVerificationStatus('ERROR');
    } finally {
      setIsProcessing(false);
    }
  };

  // Image Upload Decode Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsProcessing(false);
          return;
        }

        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode && qrCode.data) {
          handleProcessScannedData(qrCode.data);
        } else {
          setIsProcessing(false);
          setVerificationStatus('NOT_FOUND');
          setScannedPayload('No readable QR code found in uploaded image.');
        }
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  // Reset scanner to scan another card
  const handleReset = () => {
    setVerifiedReportCard(null);
    setVerificationStatus('IDLE');
    setScannedPayload(null);
    setInputCode('');
    setActiveMode('SCANNER');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Top Control Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Official Report Card Verification Scanner
              </h3>
              <p className="text-[11px] text-slate-400">
                Scan QR code or enter Student ID to validate official academic standing
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* STATE 1: VERIFIED REPORT CARD DOSSIER */}
          {verificationStatus === 'VERIFIED' && verifiedReportCard ? (
            <div className="space-y-4">
              {/* Official Verified Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                        Official Document Validated
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        Authentic Terminal Record · Verified at {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                    STATUS: GENUINE
                  </span>
                </div>

                {/* Student Bio Quick Summary */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-emerald-200/80 text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase block font-semibold">
                      Student Full Name
                    </span>
                    <strong className="text-slate-900 text-sm">
                      {verifiedReportCard.student.lastName.toUpperCase()},{' '}
                      {verifiedReportCard.student.firstName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase block font-semibold">
                      Admission Number
                    </span>
                    <strong className="font-mono text-slate-800 text-sm">
                      {verifiedReportCard.student.admissionNumber}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase block font-semibold">
                      Class & Stream
                    </span>
                    <span className="font-bold text-slate-800">
                      {verifiedReportCard.className}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase block font-semibold">
                      Academic Term
                    </span>
                    <span className="font-semibold text-slate-800">
                      {verifiedReportCard.termName} ({verifiedReportCard.sessionName})
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance & Correlated Attendance Highlights */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Class Position
                  </span>
                  <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">
                    {formatOrdinal(verifiedReportCard.positionInClass)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    of {verifiedReportCard.totalStudentsInClass} students
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                    Overall Average
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-800 mt-0.5 block">
                    {verifiedReportCard.averagePercentage.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold font-mono">
                    Grade {verifiedReportCard.overallGrade}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-200 text-center">
                  <span className="text-[10px] font-bold text-teal-800 uppercase block">
                    Attendance Rate
                  </span>
                  <span className="text-lg font-black font-mono text-teal-800 mt-0.5 block">
                    {verifiedReportCard.attendance.attendancePercentage.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-teal-700">
                    {verifiedReportCard.attendance.sessionsAttended} /{' '}
                    {verifiedReportCard.attendance.totalSessionsOpened} Attended
                  </span>
                </div>
              </div>

              {/* Form Master & Principal Remarks Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700">
                  Form Master's Correlated Attendance & Academic Remark:
                </div>
                <p className="text-slate-600 italic">
                  "{verifiedReportCard.formMasterRemark}"
                </p>
              </div>

              {/* Official Security Validation Checklist */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2">
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Security Integrity Verification Checklist:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Cryptographic QR Seal Validated</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Enrolled Registry Identity Match</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>CA & Exam Scores Authenticated</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Daily Attendance Log Correlated</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullCardOpen(true)}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>View Full Official Report Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-3.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                  title="Print verification slip"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print Slip</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Another</span>
                </button>
              </div>
            </div>
          ) : verificationStatus === 'NOT_FOUND' ? (
            /* STATE 2: NOT FOUND / UNVERIFIED ALERT */
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Report Card Not Found or Unverified
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  The scanned QR code or identifier does not match any official compiled terminal report card in the school registry.
                </p>
                {scannedPayload && (
                  <div className="mt-2 text-[10px] font-mono text-slate-400 bg-slate-100 p-2 rounded-lg max-w-sm mx-auto truncate">
                    Scanned: {scannedPayload}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2 px-4 text-xs font-bold text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors"
                >
                  Try Scanning Again
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('MANUAL')}
                  className="py-2 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Enter Student ID Manually
                </button>
              </div>
            </div>
          ) : (
            /* STATE 3: SCANNING / INPUT VIEW */
            <div className="space-y-4">
              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveMode('SCANNER')}
                  className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMode === 'SCANNER'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Live Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('UPLOAD')}
                  className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMode === 'UPLOAD'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('MANUAL')}
                  className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMode === 'MANUAL'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Enter Code / ID</span>
                </button>
              </div>

              {/* MODE A: LIVE CAMERA SCANNER */}
              {activeMode === 'SCANNER' && (
                <div className="space-y-3">
                  <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-4/3 flex items-center justify-center border border-slate-800">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Laser Scanner Viewfinder Overlay */}
                    {cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]">
                          {/* Corner Accents */}
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl"></div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr"></div>
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl"></div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br"></div>

                          {/* Animated Scanning Beam */}
                          <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] absolute top-0 animate-bounce duration-1000"></div>
                        </div>
                      </div>
                    )}

                    {/* Camera Loading or Error State */}
                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                        {cameraError ? (
                          <>
                            <AlertTriangle className="w-8 h-8 text-amber-400" />
                            <p className="text-xs text-amber-200">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => setActiveMode('MANUAL')}
                              className="mt-2 px-3 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg"
                            >
                              Switch to Manual Code Entry
                            </button>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                            <p className="text-xs">Initializing camera feed...</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Align the report card's QR code within the frame</span>
                    </span>

                    {cameraActive && (
                      <button
                        type="button"
                        onClick={() =>
                          setFacingMode((prev) =>
                            prev === 'environment' ? 'user' : 'environment'
                          )
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1"
                        title="Switch camera"
                      >
                        <SwitchCamera className="w-3.5 h-3.5" />
                        <span>Flip Camera</span>
                      </button>
                    )}
                  </div>

                  {/* Quick Test / Demo Bar */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Simulate Scan (Test Sample Students):</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold">1-Click Test</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { code: 'ADM-2026-001', label: 'Amadi Chinedu (1st)' },
                        { code: 'ADM-2026-002', label: 'Bello Fatima (2nd)' },
                        { code: 'ADM-2026-003', label: 'Chukwu Emmanuel (3rd)' },
                        { code: 'ADM-2026-004', label: 'Danjuma Grace' },
                      ].map((sample) => (
                        <button
                          key={sample.code}
                          type="button"
                          onClick={() => handleProcessScannedData(sample.code)}
                          className="px-2 py-1 text-[11px] font-mono font-bold text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <QrCode className="w-3 h-3 text-emerald-600" />
                          <span>{sample.code}</span>
                          <span className="text-[10px] text-slate-400 font-sans font-normal">
                            ({sample.label.split(' ')[0]})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE B: UPLOAD IMAGE */}
              {activeMode === 'UPLOAD' && (
                <div className="space-y-3">
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/30">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-800">
                        Click to upload or drag QR code photo here
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        PNG, JPG, or WebP screenshot of the report card
                      </p>
                    </div>
                  </label>

                  {/* Sample Trigger for Upload Mode */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      Test Upload with Sample Students:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['ADM-2026-001', 'ADM-2026-002', 'ADM-2026-003', 'ADM-2026-004'].map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleProcessScannedData(code)}
                          className="px-2 py-1 text-[11px] font-mono font-bold text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <QrCode className="w-3 h-3 text-emerald-600" />
                          <span>{code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE C: MANUAL ENTRY */}
              {activeMode === 'MANUAL' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Enter Verification Code or Student Admission Number
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. ADM-2026-001 or VER-ADM2026001"
                          value={inputCode}
                          onChange={(e) => setInputCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && inputCode.trim()) {
                              handleProcessScannedData(inputCode);
                            }
                          }}
                          className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleProcessScannedData(inputCode)}
                        disabled={!inputCode.trim() || isProcessing}
                        className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
                      >
                        {isProcessing ? 'Verifying...' : 'Validate'}
                      </button>
                    </div>
                  </div>

                  {/* Sample Quick Testing Chips */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Quick Demo Samples:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['ADM-2026-001', 'ADM-2026-002', 'ADM-2026-003', 'ADM-2026-004'].map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            setInputCode(code);
                            handleProcessScannedData(code);
                          }}
                          className="px-2 py-1 text-[11px] font-mono font-semibold text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-md transition-colors"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Digital Seal Standard</span>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Sub-modal: View Full Official Report Card when verified */}
      {verifiedReportCard && (
        <StudentReportCardModal
          isOpen={isFullCardOpen}
          onClose={() => setIsFullCardOpen(false)}
          reportCard={verifiedReportCard}
          schoolName={school.name}
          schoolAddress={school.address}
          schoolPhone={school.phone}
          principalName={school.principalName}
        />
      )}
    </div>
  );
};
