import React from 'react';

interface ExampleDisplayProps {
  exampleKobun?: string;
  exampleModern?: string;
  phase: 'question' | 'answer';
  showKobun?: boolean;
  showModern?: boolean;
  className?: string;
}

const ExampleDisplay: React.FC<ExampleDisplayProps> = ({
  exampleKobun = '',
  exampleModern = '',
  phase,
  showKobun = true,
  showModern = true,
  className = ''
}) => {
  if (!exampleKobun && !exampleModern) {
    return null;
  }

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-lg p-4 ${className}`}>
      <div className="text-xs font-medium text-slate-500 mb-2">例文</div>

      {/* Classical Japanese text with emphasized lemma */}
      {showKobun && exampleKobun && (
        <div className="mb-3">
          <div className="text-sm font-medium text-slate-600 mb-1">古文</div>
          <div className="text-base text-slate-800 leading-relaxed">
            {exampleKobun}
          </div>
        </div>
      )}

      {/* Modern Japanese translation - show during answer phase or if explicitly enabled */}
      {showModern && exampleModern && phase === 'answer' && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-1">現代語訳</div>
          <div className="text-sm text-slate-700 leading-relaxed">
            {exampleModern}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExampleDisplay;