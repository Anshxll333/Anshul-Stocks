import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, Image as ImageIcon, CheckCircle, AlertCircle, Sparkles, X, ArrowRight } from 'lucide-react';
import { uploadScreenshotApi } from '../api/chat';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  const handleFilesChange = (fileList: FileList | File[] | null) => {
    setErrorMsg(null);
    setUploadSuccess(false);

    if (!fileList || fileList.length === 0) {
      setSelectedFiles([]);
      setPreviewUrls([]);
      return;
    }

    const files = Array.from(fileList);
    const validFiles: File[] = [];
    for (const file of files) {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setErrorMsg('Invalid file format. Please upload PNG, JPEG, JPG, or WEBP images.');
        continue;
      }
      if (file.size > maxSizeBytes) {
        setErrorMsg(`File "${file.name}" exceeds 10MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setSelectedFiles([]);
      setPreviewUrls([]);
      return;
    }

    setSelectedFiles(validFiles);
    const urls: string[] = [];
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        urls.push(reader.result as string);
        if (urls.length === validFiles.length) {
          setPreviewUrls([...urls]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesChange(e.dataTransfer.files);
    }
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const records: any[] = [];
      for (const file of selectedFiles) {
        const res = await uploadScreenshotApi(file);
        records.push(res.data);
      }
      setIsUploading(false);
      setUploadSuccess(true);
      const names = records.map((r, idx) => `"${r?.originalName || selectedFiles[idx]?.name || 'image'}"`).join(', ');
      const ids = records.map(r => r?.id || 'latest').join(', ');
      setTimeout(() => {
        navigate('/chat', {
          state: {
            initialPrompt: `Analyzing ${selectedFiles.length} uploaded screenshot(s): ${names} (Upload IDs: ${ids}). Please extract OCR text, summarize key holdings or chart signals across all images, and analyze total risk exposure.`,
          },
        });
      }, 1000);
    } catch (err: any) {
      setIsUploading(false);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to upload screenshots to server.');
    }
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center min-h-[80vh]">
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--bg-subtle)] text-[var(--accent)] text-xs font-bold tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multimodal OCR & Vision AI Ready</span>
        </div>
        <h1 className="text-4xl font-[var(--font-fraunces)] font-normal text-[var(--text-primary)]">Upload IPO & Broker Screenshot</h1>
        <p className="text-[var(--text-secondary)] text-sm max-w-lg mx-auto leading-relaxed">
          Upload Groww, Zerodha, Angel One, or Upstox IPO screenshots for instant Vision AI extraction and mentor evaluation.
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div className="premium-card p-6 sm:p-8 space-y-6 bg-[var(--bg-surface)]">
        {selectedFiles.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] bg-[var(--bg-base)] rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer group flex flex-col items-center justify-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <UploadIcon className="w-8 h-8 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
            </div>

            <div>
              <p className="text-base font-semibold text-[var(--text-primary)]">
                Drag & drop your screenshots here, or{' '}
                <label className="text-[var(--accent)] hover:underline cursor-pointer">
                  browse files
                  <input
                    type="file"
                    multiple
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    className="hidden"
                    onChange={(e) => handleFilesChange(e.target.files || null)}
                  />
                </label>
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                Supported Formats: PNG, JPEG, JPG, WEBP (Max 10MB per file)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-semibold text-sm text-[var(--text-primary)]">Selected {selectedFiles.length} File(s)</span>
              </div>
              <button
                onClick={() => handleFilesChange(null)}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--danger)] flex items-center gap-1 transition-colors"
              >
                <X className="w-4 h-4" /> Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
              {previewUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-base)] flex flex-col items-center justify-center p-3 space-y-2">
                  <img
                    src={url}
                    alt={`Preview ${idx + 1}`}
                    className="max-h-48 object-contain rounded-lg shadow-sm"
                  />
                  <span className="text-xs text-[var(--text-secondary)] truncate max-w-full font-mono">{selectedFiles[idx]?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Feedback */}
        {uploadSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/20 text-[var(--success)] text-xs font-semibold">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Screenshot saved! Opening AI Mentor session...</span>
          </div>
        )}

        {/* Submit Upload Action */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={selectedFiles.length === 0 || isUploading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2 px-6"
          >
            {isUploading ? (
              <>
                <span className="w-4 h-4 border-2 border-[var(--accent-invert)] border-t-transparent rounded-full animate-spin"></span>
                <span>Processing {selectedFiles.length} File(s)...</span>
              </>
            ) : (
              <>
                <span>Analyze {selectedFiles.length > 0 ? `${selectedFiles.length} File(s) ` : ''}with AI Mentor</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
