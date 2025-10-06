import React from 'react';

interface ExampleDisplayProps {
  exampleKobun?: string;
  exampleModern?: string;
  phase: 'question' | 'answer';
  showKobun?: boolean;
  showModern?: boolean;
  forceShowModern?: boolean; // phaseに関わらず現代語訳を表示
  className?: string;
}

const ExampleDisplay: React.FC<ExampleDisplayProps> = ({
  exampleKobun = '',
  exampleModern = '',
  phase,
  showKobun = true,
  showModern = true,
  forceShowModern = false,
  className = ''
}) => {
  if (!exampleKobun && !exampleModern) {
    return null;
  }

  // forceShowModern=true なら常に表示、そうでなければ phase === 'answer' の時のみ表示
  const shouldShowModern = showModern && exampleModern && (forceShowModern || phase === 'answer');

  return (
    <div className={`border-t p-2 ${className}`}>
      {/* Classical Japanese text with emphasized lemma */}
      {showKobun && exampleKobun && (
        <div className="mb-1">
          <div className="text-sm text-slate-800 leading-normal">
            {exampleKobun}
          </div>
        </div>
      )}

      {/* Modern Japanese translation */}
      {shouldShowModern && (
        <div>
          <div className="text-sm text-slate-700 leading-normal">
            {exampleModern}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExampleDisplay;