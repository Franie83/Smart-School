// Official Report Card Verification QR Code Component
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { StudentReportCard } from '../../types/attendance';

interface ReportCardQRCodeProps {
  reportCard: StudentReportCard;
  size?: number;
  showDetails?: boolean;
  onVerifyClick?: (code: string) => void;
  className?: string;
}

export const ReportCardQRCode: React.FC<ReportCardQRCodeProps> = ({
  reportCard,
  size = 110,
  showDetails = true,
  onVerifyClick,
  className = '',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const verificationCode =
    reportCard.verificationCode ||
    `VER-${(reportCard.student.admissionNumber || reportCard.student.id)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()}`;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const verifyUrl = `${origin}${pathname}?verify=${encodeURIComponent(verificationCode)}`;

  // Structured payload for generic camera apps or internal verification
  const qrPayload = JSON.stringify({
    sys: 'SmartRegister',
    code: verificationCode,
    adm: reportCard.student.admissionNumber,
    name: `${reportCard.student.lastName} ${reportCard.student.firstName}`,
    cls: reportCard.className,
    trm: reportCard.termName,
    pos: reportCard.positionInClass,
    avg: `${reportCard.averagePercentage.toFixed(1)}%`,
    att: `${reportCard.attendance.attendancePercentage.toFixed(1)}%`,
    url: verifyUrl,
  });

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      verifyUrl, // Encoding the real verification URL so standard phone cameras open directly to it
      {
        width: size * 2, // High resolution for crisp printing
        margin: 1,
        color: {
          dark: '#0f172a', // Slate-900
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      }
    )
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [verifyUrl, size]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs ${className}`}
    >
      {/* QR Code Container */}
      <div className="shrink-0 flex flex-col items-center">
        <div
          className="bg-white p-1 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center relative group"
          style={{ width: size, height: size }}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Verification Code for ${reportCard.student.admissionNumber}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-slate-300">
              <QrCode className="w-8 h-8 animate-pulse" />
            </div>
          )}
        </div>

        <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-wider text-center block">
          Scan to Verify
        </span>
      </div>

      {/* Verification Meta Details */}
      {showDetails && (
        <div className="flex-1 min-w-0 space-y-1.5 text-left">
          <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Official Ministry / School Anti-Tamper Seal</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">
              Verification Code
            </span>
            <div className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5 select-all">
              {verificationCode}
            </div>
          </div>

          <p className="text-[10px] text-slate-500 leading-tight">
            Scan using any mobile device camera or the in-app scanner to validate grade authenticity and attendance records.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-1.5 print:hidden">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-2 py-1 text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1"
              title="Copy verification link"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            {onVerifyClick && (
              <button
                type="button"
                onClick={() => onVerifyClick(verificationCode)}
                className="px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Test Verify</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
