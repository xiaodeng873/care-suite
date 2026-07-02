import React, { useState, useCallback } from 'react';
import QRScanner from '../../components/QRScanner';
import { getBedByQrCodeId, getPatientByBedId } from '../../lib/database';
import type { Bed, Patient } from '../../lib/database';
import { AlertCircle, QrCode, Users } from 'lucide-react';

interface ScanPageProps {
  onPatientFound: (bed: Bed, patient: Patient | null) => void;
  onGoToPatients: () => void;
}

const ScanPage: React.FC<ScanPageProps> = ({ onPatientFound, onGoToPatients }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0); // re-mount scanner on retry

  const handleScanSuccess = useCallback(async (qrCodeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const bed = await getBedByQrCodeId(qrCodeId);
      if (!bed) {
        setError(`未找到对应床位（QR: ${qrCodeId}）`);
        setScanKey(k => k + 1);
        return;
      }
      const patient = await getPatientByBedId(bed.id);
      // 空床也可以进入（只开巡房 tab）
      onPatientFound(bed, patient);
    } catch (err: any) {
      setError('扫描失败：' + (err.message || '未知错误'));
      setScanKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  }, [onPatientFound]);

  const handleScanError = useCallback((err: string) => {
    setError(err);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full rounded-xl overflow-hidden bg-black aspect-square max-w-xs">
          <QRScanner
            key={scanKey}
            acceptType="bed"
            autoStart
            onScanSuccess={handleScanSuccess}
            onError={handleScanError}
            className="w-full h-full"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">查询中…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 w-full max-w-xs">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <button
            onClick={onGoToPatients}
            className="flex items-center gap-2 w-full justify-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">手动选择院友</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
