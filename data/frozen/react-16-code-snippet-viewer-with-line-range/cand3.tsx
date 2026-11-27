import React from 'react';

interface HighlightedSnippetProps {
  code: string;
  highlightLines: string;
}

const HighlightedSnippet: React.FC<HighlightedSnippetProps> = ({ code, highlightLines }) => {
  const lines = code.split(/\r?\n/);
  const highlightedRanges = highlightLines.split(',').map(range => {
    const [startStr, endStr] = range.split('-');
    const start = parseInt(startStr, 10) - 1;
    const end = endStr ? parseInt(endStr, 10) - 1 : start;
    return { start, end };
  }).filter(range => range.start >= 0 && range.end < lines.length);

  return (
    <pre>
      {lines.map((line, index) => {
        const shouldHighlight = highlightedRanges.some(range => index >= range.start && index <= range.end);
        return (
          <code key={index}>
            {index + 1}:<span data-highlighted={shouldHighlight ? 'true' : 'false'}>{line}</span>
          </code>
        );
      })}
    </pre>
  );
};

export { HighlightedSnippet };
