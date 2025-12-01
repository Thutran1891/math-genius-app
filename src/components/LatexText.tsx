import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css'; // Import CSS để hiển thị đúng font toán học

interface LatexTextProps {
  text: string;
}

export const LatexText: React.FC<LatexTextProps> = ({ text }) => {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    // Tách chuỗi bởi dấu $ hoặc \[...\] hoặc $$...$$
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[\s\S]*?\$)/g);
    
    return parts.map((part, index) => {
        // Kiểm tra xem phần này có phải là công thức toán không
        if (part.startsWith('$') || part.startsWith('\\[')) {
            // Xác định xem là block (công thức lớn) hay inline (công thức dòng)
            const isBlock = part.startsWith('$$') || part.startsWith('\\[');
            // Loại bỏ các ký tự bao quanh để lấy nội dung công thức
            const content = isBlock ? part.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '') : part.slice(1, -1);
            
            try {
                // Dùng katex render trực tiếp ra HTML
                const html = katex.renderToString(content, { 
                    throwOnError: false, 
                    displayMode: isBlock,
                    output: 'html' // Chỉ xuất HTML để nhẹ
                });
                
                return isBlock 
                    ? <div key={index} dangerouslySetInnerHTML={{ __html: html }} className="my-2 text-center overflow-x-auto" />
                    : <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
            } catch (error) {
                console.error("Katex error:", error);
                return <span key={index} className="text-red-500">{part}</span>;
            }
        } else {
            // Text thường: Render trực tiếp
            return <span key={index}>{part}</span>;
        }
    });
  }, [text]);

  return <>{renderedContent}</>;
};