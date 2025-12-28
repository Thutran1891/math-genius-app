// LatexText.tsx
import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css'; 

interface LatexTextProps {
  text: string;
}

export const LatexText: React.FC<LatexTextProps> = ({ text }) => {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    // SỬA LỖI TẠI ĐÂY: Tách các lệnh dính liền thường gặp từ AI
    const cleanedText = text
        .replace(/\\displaystyleint/g, '\\displaystyle \\int')
        .replace(/\\displaystylelim/g, '\\displaystyle \\lim')
        .replace(/\\displaystylesum/g, '\\displaystyle \\sum');

    const parts = cleanedText.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[\s\S]*?\$)/g);
    
    return parts.map((part, index) => {
        if (part.startsWith('$') || part.startsWith('\\[')) {
            const isBlock = part.startsWith('$$') || part.startsWith('\\[');
            const content = isBlock ? part.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '') : part.slice(1, -1);
            
            try {
                const html = katex.renderToString(content, { 
                    throwOnError: false, 
                    displayMode: isBlock,
                    output: 'html' 
                });
                
                return isBlock 
                    ? <div key={index} dangerouslySetInnerHTML={{ __html: html }} className="my-2 text-center overflow-x-auto" />
                    : <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
            } catch (error) {
                return <span key={index} className="text-red-500">{part}</span>;
            }
        } else {
            // Hỗ trợ xuống dòng cho text thuần
            return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
        }
    });
  }, [text]);

  return <>{renderedContent}</>;
};