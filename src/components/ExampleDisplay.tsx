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
    <div className={`border-t p-3 ${className}`}>
      {/* Classical Japanese text with emphasized lemma */}
      {showKobun && exampleKobun && (
        <div className="mb-2">
          <div className="text-sm text-slate-800 leading-normal">
            {exampleKobun}
          </div>
        </div>
      )}

      {/* Modern Japanese translation - show during answer phase or if explicitly enabled */}
      {showModern && exampleModern && phase === 'answer' && (
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