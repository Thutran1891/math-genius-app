// src/utils/pdfHelper.ts
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PdfPagePreview {
  pageNumber: number;
  thumbnail: string; // Base64 để hiển thị nhanh
  originalPage: any;  // Đối tượng trang để render lại sau này
}

export const getPdfPagesPreview = async (pdfFile: File): Promise<PdfPagePreview[]> => {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const previews: PdfPagePreview[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 }); // Scale nhỏ để làm thumbnail
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ 
        canvasContext: context, 
        viewport: viewport 
      } as any).promise;
      previews.push({
        pageNumber: i,
        thumbnail: canvas.toDataURL('image/jpeg', 0.7),
        originalPage: page
      });
    }
  }
  return previews;
};

export const renderHighResPage = async (page: any): Promise<File> => {
  const viewport = page.getViewport({ scale: 2.0 }); // Chất lượng cao cho OCR
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  if (!context) throw new Error("Canvas context failed");
  await page.render({ canvasContext: context, viewport }).promise;
  
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  return new File([blob!], `page_${page.pageNumber}.jpg`, { type: 'image/jpeg' });
};