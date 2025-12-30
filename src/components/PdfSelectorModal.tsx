// src/components/PdfSelectorModal.tsx
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { PdfPagePreview } from '../utils/pdfHelper';

interface Props {
  previews: PdfPagePreview[];
  onConfirm: (selectedPages: any[]) => void;
  onClose: () => void;
}

export const PdfSelectorModal: React.FC<Props> = ({ previews, onConfirm, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const togglePage = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h3 className="font-bold text-gray-800">Chọn trang từ PDF (Tối đa 4 trang)</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full"><X/></button>
        </div>
        
        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {previews.map((p) => (
            <div 
              key={p.pageNumber}
              onClick={() => togglePage(p.pageNumber)}
              className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                selectedIds.includes(p.pageNumber) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'
              }`}
            >
              <img src={p.thumbnail} className="w-full rounded-md shadow-sm" alt="" />
              <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">
                Trang {p.pageNumber}
              </div>
              {selectedIds.includes(p.pageNumber) && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                  <div className="bg-blue-500 text-white rounded-full p-1 shadow-lg">
                    <Check size={20} strokeWidth={3}/>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <span className="self-center text-sm font-medium text-gray-500">Đã chọn {selectedIds.length} trang</span>
          <button 
            onClick={() => {
              const selected = previews.filter(p => selectedIds.includes(p.pageNumber)).map(p => p.originalPage);
              onConfirm(selected);
            }}
            disabled={selectedIds.length === 0 || selectedIds.length > 4}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
          >
            Xác nhận trích xuất
          </button>
        </div>
      </div>
    </div>
  );
};